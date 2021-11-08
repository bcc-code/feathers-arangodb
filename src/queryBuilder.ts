import _isNumber from "lodash/isNumber";
import _isBoolean from "lodash/isBoolean";
import _isObject from "lodash/isObject";
import _isString from "lodash/isString";
import _omit from "lodash/omit";
import _get from "lodash/get";
import _set from "lodash/set";
import _isEmpty from "lodash/isEmpty";
import { Params } from "@feathersjs/feathers";
import { aql } from "arangojs";
import { AqlQuery, AqlValue, GeneratedAqlQuery } from "arangojs/aql";
import { AqlLiteral } from "arangojs/aql";
import { addSearch } from "./searchBuilder"

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
  ];
  bindVars: { [key: string]: any } = { };
  maxLimit = 1000000000; // A billion records...
  _limit: number = -1;
  _countNeed: string = "";
  _skip: number = 0;
  sort?: AqlQuery;
  filter?: AqlQuery;
  returnFilter?: AqlQuery | AqlLiteral;
  withStatement?: AqlQuery;
  tokensStatement?: AqlQuery;
  _collection: string;
  search?: AqlQuery;
  varCount: number = 0;

  constructor(
    params: Params,
    collectionName: string = "",
  ) {
    this._collection = collectionName;
    this.create(params);
  }

  getParameterizedPath(path: string): GeneratedAqlQuery {
    const pathArray = path.split('.').map((field:string) => aql`[${field}]`)
    return aql.join([
      aql`doc`,
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
            : this.getParameterizedPath(v),
        ],
        " "
      );
    });

    return aql.join(result, ", ");
  }

  selectBuilder(params: Params): AqlQuery {
    const select:string[] | undefined = params.query?.$select

    if(!select?.length)
      return aql`RETURN doc`;

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
    console.log(`Query from client: ${JSON.stringify(query)}, docName:doc, returnDocName:doc`)
    this._runCheck(query);
    return this;
  }

  _runCheck(
    query: any,
  ) {
    if (!query || _isEmpty(query)) return this;
    const queryParamaters = Object.keys(query)
    queryParamaters.forEach((key: string) => {
      const testKey = key.toLowerCase();
      const value = query[key];
      switch (testKey) {
        case "$select":
        case "$resolve":
          break;
        case "$limit":
          this._limit = parseInt(value);
          break;
        case "$skip":
          this._skip = parseInt(value);
          break;
        case "$sort":
          this.addSort(value);
          break;
        case "$search":
          this.search = addSearch(value, this._collection);
          break;
      }
    });
    this.filter = this._aqlFilterFromFeathersQuery(query, aql`doc`)
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

  get limit(): AqlValue {
    if (this._limit === -1 && this._skip === 0) return aql.literal("");
    const realLimit = this._limit > -1 ? this._limit : this.maxLimit;
    return aql`LIMIT ${this._skip}, ${realLimit}`;
  }

  addSort(sort: any) {
    if (Object.keys(sort).length > 0) {
      this.sort = aql.join(
        Object.keys(sort).map((key: string) => {
          return aql.join([
            this.getParameterizedPath(key), 
            aql.literal(parseInt(sort[key]) === -1 ? "DESC" : "")
          ], ' ');
        }),
        ", "
      );
    }
  }
}
