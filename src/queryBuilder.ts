import _isObject from "lodash/isObject";
import _isString from "lodash/isString";
import _get from "lodash/get";
import _set from "lodash/set";
import _isEmpty from "lodash/isEmpty";
import { Params } from "@feathersjs/feathers";
import { aql } from "arangojs";
import { AqlQuery, AqlValue, GeneratedAqlQuery } from "arangojs/aql";
import { AqlLiteral } from "arangojs/aql";
import { generateFuzzyStatement, isQueryTypeCorrect, SearchField } from "./searchBuilder"
import logger from "./logger";
import { BadRequest } from "@feathersjs/errors";

export enum LogicalOperator {
    And = " AND ",
    Or = " OR "
}

export class QueryBuilder {
  reserved = [
    "$select",
    "$limit",
    "$skip",
    "$sort",
    "$in",
    "$nin",
    "$lt",
    "$lte",
    "$gt",
    "$gte",
    "$ne",
    "$not",
    "$or",
    "$and",
    "$aql",
    "$resolve",
    "$search",
    "$elemMatch",
  ];
  bindVars: { [key: string]: any } = { };
  maxLimit = 1000000000; // A billion records...
  _limit: number = -1;
  _countNeed: string = "";
  _skip: number = 0;;
  _search?: AqlQuery;
  _sort?: AqlQuery;
  searchFields: SearchField[];
  _filter?: AqlQuery;
  docName = "doc";
  returnDocName = "doc";
  returnFilter?: AqlQuery | AqlLiteral;
  varCount: number = 0;

  constructor(
    params: Params,
    docName: string = "doc",
    returnDocName: string = "doc",
    searchFields: SearchField[] = []
  ) {
    this.searchFields = searchFields
    this.docName = docName
    this.returnDocName = returnDocName
    this.create(params);
  }

  getParameterizedPath(path: string, basePath: string): GeneratedAqlQuery {
    const pathArray = path.split('.').map((field:string) => aql`[${field}]`)
    return aql.join([
      aql.literal(basePath),
      ...pathArray
    ], '')
  }

  projectRecursive(o: object): AqlValue {
    const result = Object.keys(o).map((field: string, ind: number) => {
      const v: any = _get(o, field);
      return aql.join(
        [
          aql`[${field}]:`,
          _isObject(v)
            ? aql.join([
              aql.literal("{"),
              this.projectRecursive(v),
              aql.literal("}"),
            ])
            : this.getParameterizedPath(v, this.returnDocName),
        ],
        " "
      );
    });

    return aql.join(result, ", ");
  }

  selectBuilder(params: Params): AqlQuery | AqlLiteral {
    const select:string[] | undefined = params.query?.$select

    if(!select?.length)
      return aql.literal(`RETURN ${this.returnDocName}`);

    const ret = { };
    select.forEach((fieldName: string) => {
      _set(ret, fieldName, fieldName);
    });
    _set(ret, '_key', '_key')
    return aql.join(
      [
        aql`RETURN {`,
        this.projectRecursive(ret),
        aql`}`,
      ],
      " "
    );
  }

  create(
    params: Params,
  ): QueryBuilder {
    this.returnFilter = this.selectBuilder(params);
    const query = _get(params, "query", null);
    logger.debug("Query object received from client:", query)
    this._runCheck(query);
    return this;
  }

  _runCheck(
    query: unknown,
  ) {
    if(!isQueryObject(query)) return this;
    if (query.$limit !== undefined) this._limit = parseIntTypeSafe(query.$limit)
    if (query.$skip !== undefined) this._skip = parseIntTypeSafe(query.$skip)
    if (query.$sort !== undefined) this._sort = this.addSort(query.$sort)
    if (query.$search !== undefined) this._search = this.addSearch(this.searchFields, query.$search)
    this._filter = this._aqlFilterFromFeathersQuery(query, aql.literal(this.docName))
  }

  _aqlFilterFromFeathersQuery(
    feathersQuery: boolean | number | string | null | object,
    aqlFilterVar: AqlQuery | AqlLiteral
  ): AqlQuery | undefined {
    if(typeof feathersQuery !== "object" || feathersQuery === null){
      return aql.join([aqlFilterVar, aql`${feathersQuery}`], " == ")
    }
    const aqlFilters: (AqlQuery | undefined)[] = []
    for(const [key, value] of Object.entries(feathersQuery)){
      let operator;
      switch(key) {
        case "$in": operator = " ANY == "; break;
        case "$nin": operator = " NONE == "; break;
        case "$not":
        case "$ne": operator = " != "; break;
        case "$lt": operator = " > "; break;
        case "$lte": operator = " >= "; break;
        case "$gt": operator = " < "; break;
        case "$gte": operator = " <= "; break;
        case "$elemMatch": aqlFilters.push(this._aqlFilterArrayElement(value, aqlFilterVar)); continue;
        case "$or": aqlFilters.push(this._aqlFilterFromFeathersQueryArray(value, aqlFilterVar, LogicalOperator.Or)); continue;
        case "$and": aqlFilters.push(this._aqlFilterFromFeathersQueryArray(value, aqlFilterVar, LogicalOperator.And)); continue;
        case "$size": aqlFilters.push(this._aqlFilterFromFeathersQuery(value, aql`LENGTH(${aqlFilterVar})`)); continue;
      }
      if(operator){
        aqlFilters.push(aql.join([
          aql`${value}`,
          aqlFilterVar,
        ], operator))
        continue
      }
      if (!this.reserved.includes(key)){
        aqlFilters.push(this._aqlFilterFromFeathersQuery(value, aql.join([aqlFilterVar, aql`[${key}]`], '')))
      }
    }
    return this._joinAqlFiltersWithOperator(aqlFilters, LogicalOperator.And)
  }

  _aqlFilterArrayElement(
    elementQuery: any,
    aqlFilterVar: AqlQuery | AqlLiteral,
  ): AqlQuery | undefined {
    const elementFilter = aql`FILTER ${this._aqlFilterFromFeathersQuery(elementQuery, aql`CURRENT`)}`
    return aql`LENGTH(${aqlFilterVar}[* ${elementFilter} RETURN CURRENT])`;
  }

  _aqlFilterFromFeathersQueryArray(
    feathersQueries: any[],
    aqlFilterVar: AqlQuery | AqlLiteral,
    operator: LogicalOperator,
  ): AqlQuery | undefined {
    const aqlFilters = feathersQueries.map((f: any) => this._aqlFilterFromFeathersQuery(f, aqlFilterVar))
    return this._joinAqlFiltersWithOperator(aqlFilters, operator)
  }

  _joinAqlFiltersWithOperator(
    aqlFilters: (AqlQuery | undefined)[],
    operator: LogicalOperator
  ): AqlQuery | undefined{
    const filtered = aqlFilters.filter((c: AqlQuery | undefined) =>  c !== undefined)

    if(!filtered.length) return undefined

    const combined = aql.join(filtered, operator)
    if(operator === LogicalOperator.And)
      return combined
    return aql`(${combined})`
  }

  addSort(sort: unknown): AqlQuery | undefined {
    if(!isQueryObject(sort)) throw new BadRequest("Sort has incorrect type")
    if (Object.keys(sort).length > 0) {
      return aql.join(
        Object.keys(sort).map((key: string) => {
          return aql.join([
            this.getParameterizedPath(key, this.docName),
            aql.literal(parseIntTypeSafe(sort[key]) === -1 ? "DESC" : "")
          ], ' ');
        }),
        ", "
      );
    }
  }

  addSearch( searchFields: SearchField[], search: unknown) {
    if(!searchFields.length)
    throw new BadRequest('A search has been attempted on a collection where no search logic has been defined')
  
    if(!isQueryTypeCorrect(search)){
      throw new BadRequest('Invalid query type');
    }

    return generateFuzzyStatement(searchFields, search)
  }
  get limit(): AqlQuery {
    if (this._limit === -1 && this._skip === 0) return aql``
    const realLimit = this._limit > -1 ? this._limit : this.maxLimit;
    return aql`LIMIT ${this._skip}, ${realLimit}`;
  }

  get sort(): AqlQuery {
    if (this._search) {
      return aql`SORT BM25(${aql.literal(this.docName)}) desc`
    }
    if (this._sort) {
      return aql`SORT ${this._sort}`
    }
    return aql``
  }

  get filter(): AqlQuery | undefined {
    const filterParts:AqlQuery[] = []
    if(this._search) {
      filterParts.push(aql`(${this._search})`)
    }
    if(this._filter) {
      filterParts.push(aql`(${this._filter})`)
    }
    if(!filterParts.length)
      return undefined
    return aql.join(filterParts, LogicalOperator.And)
  }

}

function isQueryObject(query: unknown): query is Record<string, unknown>{
  if(!query) return false
  return typeof query === "object"
}

function parseIntTypeSafe(value: unknown):number {
  if(typeof value === "number") return value
  if(typeof value !== "string") return NaN;
  return parseInt(value);
}
