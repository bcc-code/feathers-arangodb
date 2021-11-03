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
import { AqlQuery, AqlValue } from "arangojs/aql";
import { AqlLiteral } from "arangojs/aql";
import { addSearch } from "./searchBuilder"
import sanitizeFieldName from "./sanitizeQuery";

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
    "$calculate"
  ];
  bindVars: { [key: string]: any } = { };
  maxLimit = 1000000000; // A billion records...
  _limit: number = -1;
  _countNeed: string = "";
  _skip: number = 0;
  sort?: AqlQuery;
  filter?: AqlQuery;
  returnFilter?: AqlQuery;
  withStatement?: AqlQuery;
  tokensStatement?: AqlQuery;
  _collection: string;
  search?: AqlLiteral;
  varCount: number = 0;

  constructor(
    params: Params,
    collectionName: string = "",
    docName: string = "doc",
    returnDocName: string = "doc"
  ) {
    this._collection = collectionName;
    this.create(params, docName, returnDocName);
  }

  projectRecursive(o: object): AqlValue {
    const result = Object.keys(o).map((field: string) => {
      const v: any = _get(o, field);
      return aql.join(
        [
          aql.literal(`"${field}":`),
          _isObject(v)
            ? aql.join([
              aql.literal("{"),
              this.projectRecursive(v),
              aql.literal("}"),
            ])
            : aql.literal(`${v}`),
        ],
        " "
      );
    });

    return aql.join(result, ", ");
  }

  selectBuilder(params: Params, docName: string = "doc"): AqlQuery {
    let filter = aql.join([aql.literal(`RETURN ${docName}`)]);
    const select = _get(params, "query.$select", null);
    if (select && select.length > 0) {
      var ret = { };
      _set(ret, "_key", docName + "._key");
      select.forEach((fieldName: string) => {
        var tempFieldName = sanitizeFieldName(fieldName, true)
        _set(ret, tempFieldName, docName + "." + tempFieldName);
      });
      filter = aql.join(
        [
          aql`RETURN`,
          aql.literal("{"),
          this.projectRecursive(ret),
          aql.literal("}"),
        ],
        " "
      );
    }
    this.returnFilter = filter;
    return filter;
  }

  create(
    params: Params,
    docName: string = "doc",
    returnDocName: string = "doc"
  ): QueryBuilder {
    this.selectBuilder(params, returnDocName);
    const query = _get(params, "query", null);
    console.log(`Query from client: ${JSON.stringify(query)}, docName:${docName}, returnDocName:${returnDocName}`)
    this._runCheck(query, docName, returnDocName);
    return this;
  }

  _runCheck(
    query: any,
    docName: string = "doc",
    returnDocName: string = "doc",
  ) {
    if (!query || _isEmpty(query)) return this;
    const queryParamaters = Object.keys(query)
    queryParamaters.forEach((key: string) => {
      const testKey = key.toLowerCase();
      const value = query[key];
      switch (testKey) {
        case "$select":
        case "$resolve":
        case "$calculate":
          break;
        case "$limit":
          this._limit = parseInt(value);
          break;
        case "$skip":
          this._skip = parseInt(value);
          break;
        case "$sort":
          this.addSort(value, docName);
          break;
        case "$search":
          this.search = addSearch(value, docName, this._collection);
          break;
      }
    });
    this.filter = this._aqlFilterFromFeathersQuery(query, docName)
  }

  _aqlFilterFromFeathersQuery(
    feathersQuery: boolean | number | string | null | object,
    aqlFilterVar: string
  ): AqlQuery | undefined {
    if(typeof feathersQuery !== "object" || feathersQuery === null){
      return aql.join([aql.literal(aqlFilterVar), aql`${feathersQuery}`], " == ")
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
        case "$size": aqlFilters.push(this._aqlFilterFromFeathersQuery(value, `LENGTH(${aqlFilterVar})`)); continue;
      }
      if(operator){
        aqlFilters.push(aql.join([
          aql`${value}`,
          aql.literal(aqlFilterVar),
        ], operator))
        continue
      }
      if (!this.reserved.includes(key)){
        aqlFilters.push(this._aqlFilterFromFeathersQuery(value, `${aqlFilterVar}.${sanitizeFieldName(key, true)}`))
      }
    }
    return this._joinAqlFiltersWithOperator(aqlFilters, LogicalOperator.And)
  }

  _aqlFilterFromFeathersQueryArray(
    feathersQueries: any[],
    aqlFilterVar: string,
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
    return aql.join([aql.literal("("), combined, aql.literal(")")])
  }

  get limit(): AqlValue {
    if (this._limit === -1 && this._skip === 0) return aql.literal("");
    const realLimit = this._limit > -1 ? this._limit : this.maxLimit;
    return aql.literal(`LIMIT ${this._skip}, ${realLimit}`);
  }

  addSort(sort: any, docName: string = "doc") {
    if (Object.keys(sort).length > 0) {
      this.sort = aql.join(
        Object.keys(sort).map((key: string) => {
          return aql.literal(
            `${docName}.${sanitizeFieldName(key, true)} ${parseInt(sort[key]) === -1 ? "DESC" : ""}`
          );
        }),
        ", "
      );
    }
  }
}
