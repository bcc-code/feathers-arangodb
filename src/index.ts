import { NotFound } from "@feathersjs/errors";
import { Database } from "arangojs/database";
import { DocumentCollection } from "arangojs/collection";
import { LoadBalancingStrategy, Config } from "arangojs/connection";
import { AqlQuery, aql } from "arangojs/aql";
import { Graph } from "arangojs/graph";
import {
  Application,
  Id,
  NullableId,
  Paginated,
  Params,
  Service,
} from "@feathersjs/feathers";
import _isEmpty from "lodash/isEmpty";
import isString from "lodash/isString";
import omit from "lodash/omit";
import { LogicalOperator, QueryBuilder } from "./queryBuilder";
import { GraphVertexCollection } from "arangojs/graph";
import { ArrayCursor } from "arangojs/cursor";
import { View } from "arangojs/view";
import logger from "./logger";
import { isArangoTransaction, Transaction } from "arangojs/transaction";
import { isArangoError } from "arangojs/error";
import { RetryDatabase } from "./retry-database";
import { AutoDatabse } from "./auto-database";
import { SearchField } from "./searchBuilder";

export declare type ArangoDbConfig =
  | string
  | string[]
  | Partial<{
      url: string | string[];
      isAbsolute: boolean;
      arangoVersion: number;
      loadBalancingStrategy: LoadBalancingStrategy;
      maxRetries: false | number;
      agent: any;
      agentOptions: {
        [key: string]: any;
      };
      headers: {
        [key: string]: string;
      };
    }>;

export enum AUTH_TYPES {
  BASIC_AUTH = "BASIC_AUTH",
  BEARER_AUTH = "BEARER_AUTH",
}

export declare interface Paginate {
  max?: number;
  default?: number;
}

export interface IConnectResponse {
  database: AutoDatabse | Database;
  collection: DocumentCollection | GraphVertexCollection;
  graph?: Graph;
  view?: View;
}

export interface IGraphOptions {
  properties?: any;
  opts?: { waitForSync?: boolean };
}

export interface IOptions {
  id?: string;
  expandData?: boolean;
  collection:
    | DocumentCollection
    | GraphVertexCollection
    | string
    | Promise<DocumentCollection | GraphVertexCollection>;
  view?:
    | View
    | string
    | Promise<View>;
  database: AutoDatabse | Database | string | Promise<AutoDatabse | Database>;
  graph?: Graph | IGraphOptions;
  authType?: AUTH_TYPES;
  username?: string;
  password?: string;
  token?: string;
  searchFields?: SearchField[];
  enforceViewForFindQueries?: boolean;
  dbConfig?: Config;
  events?: any[];
  paginate?: Paginate;
}

export interface IArangoDbService<T> extends Service<T> {
  events: any[];
  paginate: Paginate;
  readonly id: string;
  readonly database: Database;
  readonly collection: DocumentCollection | GraphVertexCollection;
  readonly view: View;
  connect(): Promise<IConnectResponse>;
  setup(): Promise<void>;
}

export class DbService<T> {
  public events: any[] = [];
  public readonly options: IOptions;
  private readonly _id: string;
  private _database: AutoDatabse | Database | undefined;
  private _databasePromise: Promise<AutoDatabse | Database> | undefined;
  private _collection: DocumentCollection | GraphVertexCollection | undefined;
  private _collectionPromise:
    | Promise<DocumentCollection | GraphVertexCollection>
    | undefined;
  private _view: View | undefined;
  private _viewPromise:
    | Promise<View>
    | undefined;
  private _graph: Graph | undefined;
  private _graphPromise: Promise<Graph> | undefined;
  private _paginate: Paginate;
  constructor(options: IOptions) {
    // Runtime checks
    /* istanbul ignore next */
    if (!options.collection) {
      throw new Error("A collection reference or name is required");
    }
    /* istanbul ignore next */
    if (!options.database) {
      throw new Error("A database reference or name is required");
    }
    /* istanbul ignore next */
    if (options.id && ["_rev"].indexOf(options.id) !== -1) {
      throw new Error(`Database id name of ${options.id} is a reserved key`);
    }
    this._id = options.id || "_id";
    this.events = options.events || this.events;
    this._paginate = options.paginate || {};
    this.options = options;
    // Set the database if passed an existing DB
    /* istanbul ignore next */
    if (options.database instanceof Promise) {
      this._databasePromise = options.database;
    } else if (options.database instanceof Database) {
      this._database = options.database;
    } else if (!isString(options.database)) {
      throw new Error("Database reference or name (string) is required");
    }

    if (options.graph instanceof Promise) {
      this._graphPromise = options.graph;
    } else if (options.graph instanceof Graph) {
      this._graph = options.graph;
    }

    // Set the collection if it is connected
    /* istanbul ignore next */
    if (options.collection instanceof Promise) {
      this._collectionPromise = options.collection;
    } else if (!isString(options.collection) && !!options.collection) {
      this._collection = <DocumentCollection | GraphVertexCollection>(
        options.collection
      );
    } else if (!options.collection) {
      throw new Error("Collection reference or name (string) is required");
    }

    // Set the view if it is connected
    /* istanbul ignore next */
    if (options.view instanceof Promise) {
      this._viewPromise = options.view;
    } else if (!isString(options.view) && !!options.view) {
      this._view = <View>(
        options.view
      );
    }
  }

  public async connect(): Promise<IConnectResponse> {
    const {
      authType,
      username,
      password,
      token,
      graph,
      dbConfig,
    } = this.options;
    if (this._database === undefined && this._databasePromise) {
      this._database = await this._databasePromise;
    }
    /* istanbul ignore next */
    if (this._database === undefined) {
      let db = new RetryDatabase(dbConfig);
      switch (authType) {
        case AUTH_TYPES.BASIC_AUTH:
          db.useBasicAuth(username, password);
          break;
        case AUTH_TYPES.BEARER_AUTH:
          /* istanbul ignore next  Testing will assuming working SDK  */
          if (token) {
            await db.useBearerAuth(token || "");
          } else {
            await db.login(username, password);
          }
          break;
      }
      await db.autoUseDatabase(this.options.database as string);
      this._database = db;
    }

    if (!this._graph && this._graphPromise) {
      this._graph = await this._graphPromise;
    }

    if (graph && !this._graph) {
      const { properties, opts } = <IGraphOptions>graph;
      if (this._database instanceof AutoDatabse) {
        this._graph = await this._database.autoGraph(properties, opts);
      } else {
        throw `Auto creation of graphs requires instance of AutoDatabase`;
      }
    }

    /* istanbul ignore next  This doens't need to be tested  */
    if (this._collectionPromise) {
      this._collection = await this._collectionPromise;
    }

    if (this._collection === undefined) {
      if (this._database instanceof AutoDatabse) {
        this._collection = await this._database.autoCollection(
          this.options.collection as string
        );
      } else {
        throw `Auto creation of collections requires instance of AutoDatabase`;
      }
    }

    if (this._viewPromise) {
      this._view = await this._viewPromise;
    }

    if (this._view === undefined) {
      if (this._database instanceof AutoDatabse) {
        this._view = await this._database.autoView(
          this.options.view as string
        );
      } else {
        throw `Auto creation of collections requires instance of AutoDatabase`;
      }
    }

    return {
      database: this._database,
      collection: this._collection,
      view: this._view
    };
  }

  get id(): string {
    return this._id;
  }

  get database(): AutoDatabse | Database | undefined {
    return this._database;
  }

  get collection(): DocumentCollection | GraphVertexCollection | undefined {
    return this._collection;
  }

  get view(): View | undefined {
    return this._view;
  }

  get paginate(): Paginate {
    return this._paginate;
  }

  set paginate(option: Paginate) {
    this._paginate = option || this._paginate;
  }

  public _injectPagination(params: Params): Params {
    params = params || {};
    if (_isEmpty(this._paginate) || (params && params.paginate) === false) {
      return params;
    }
    const paginate = (params.paginate as Paginate) || this._paginate;
    params.query = params.query || {};
    let limit = parseInt(params.query.$limit);
    limit =
      isNaN(limit) || limit === null
        ? paginate.default || paginate.max || 0
        : limit;
    limit = Math.min(limit, paginate.max || paginate.default || limit);
    params.query.$limit = limit;
    return params;
  }

  public fixKeyReturn(item: any): any {
    const idObj: any = {};

    if (typeof item == "object" && item != null) {
      idObj[this._id] = item._id;


      const removeKeys = [];
      if (!this.options.expandData) {
        removeKeys.push("_id", "_rev");
      }

      return { ...idObj, ...omit(item, removeKeys) };
    }
    return null;
  }

  public async _returnMap(
    database: Database,
    query: AqlQuery,
    errorMessage?: string,
    removeArray = true,
    paging = false,
    transaction?: Transaction,
  ) {
    async function getCursor() {
      try {
        return await database
          .query(query, { fullCount: paging });
      } catch (error) {
        if (isArangoError(error) &&
          error.errorNum === 1202 &&
          errorMessage) {
          throw new NotFound(errorMessage);
        } else {
          throw error;
        }
      }
    }

    let cursor: ArrayCursor;
    if(isArangoTransaction(transaction)) cursor = await transaction.step(getCursor);
    else cursor = await getCursor();


    const unfiltered: T[] = await cursor.map((item) => item);
    const result = unfiltered.filter((item) => item != null);

    if (
      (result.length === 0 || (result.length === 1 && result[0] == null)) &&
      errorMessage
    ) {
      throw new NotFound(errorMessage);
    }

    if (paging) {
      return {
        total: cursor.extra.stats?.fullCount,
        data: result,
      };
    }
    return result.length > 1 || !removeArray ? result : result[0];
  }

  public async find(params: Params,existingQuery?:QueryBuilder): Promise<any[] | Paginated<any>> {
    let { database, collection, view} = await this.connect();
    params = this._injectPagination(params);

    let queryBuilder =new QueryBuilder(params,"doc", "doc", this.options.searchFields);
    if (existingQuery) {
      queryBuilder =  existingQuery
    }

    let useView = queryBuilder._search || this.options.enforceViewForFindQueries;

    const query = aql.join(
      [
        aql`FOR doc in ${useView ?  view : collection}`,
        queryBuilder.filter ? (useView ? aql`SEARCH` : aql`FILTER`) : aql``,
        queryBuilder.filter ?? aql``,
        queryBuilder.sort,
        queryBuilder.limit,
        queryBuilder.returnFilter,
      ],
      " "
    );

    logger.debug("Generated aql:", {query: query.query, bindVars: query.bindVars});

    const result = (await this._returnMap(
      database,
      query,
      undefined,
      false,
      !_isEmpty(this._paginate),
      params.transaction
    )) as any;

    if (!_isEmpty(this._paginate)) {
      return {
        total: result.total,
        // @ts-ignore   Will be defined based on previous logic
        limit: params.query.$limit || 0,
        // @ts-ignore   Will be defined based on previous logic
        skip: params.query.$skip || 0,
        data: result.data,
      };
    }
    return result;
  }

  public async get(id: Id, params: Params, existingQuery?:QueryBuilder) {
    const { database, collection } = await this.connect();
    let queryBuilder =new QueryBuilder(params);
    if (existingQuery) {
      queryBuilder =  existingQuery
    }

    const addedfilter = queryBuilder._aqlFilterFromFeathersQuery({_key: id}, aql`doc`);
    queryBuilder._filter = queryBuilder._joinAqlFiltersWithOperator([queryBuilder._filter, addedfilter], LogicalOperator.And)

    const query: AqlQuery = aql.join(
      [
        aql`FOR doc IN ${collection}`,
        queryBuilder.filter ? aql`FILTER`: aql``,
        queryBuilder.filter,
        queryBuilder.returnFilter,
      ],
      " "
    );
    return this._returnMap(database, query, `No record found for id '${id}'`, true, false, params.transaction);
  }


  public async create(
    data: Partial<any> | Array<Partial<any>>,
    params: Params
  ) {
    data = Array.isArray(data) ? data : [data]
    const { database, collection } = await this.connect();
    const queryBuilder = new QueryBuilder(params);

    const query = aql`
        FOR item IN ${data}
          INSERT item IN ${collection}
          let doc = NEW
        ${queryBuilder.returnFilter}`;
    return this._returnMap(database, query, undefined, true, false, params.transaction);
  }

  public async _replaceOrPatch(
    fOpt = "REPLACE",
    id: NullableId | NullableId[],
    data: Partial<any>,
    params: Params
  ) {
    const { database, collection } = await this.connect();
    const ids: NullableId[] = Array.isArray(id) ? id : [id];
    let query: AqlQuery;
    const queryBuilder = new QueryBuilder(params, "doc", "changed");
    if (ids.length > 0 && (ids[0] != null || ids[0] != undefined)) {
      
      query = aql.join(
        [
          aql`FOR doc IN ${ids}`,
          aql.literal(`${fOpt}`),
          aql`doc WITH ${data} IN ${collection}`,
          aql`LET changed = NEW`,
          queryBuilder.returnFilter,
        ],
        " "
      );
    } else {
      query = aql.join(
        [
          aql`FOR doc IN ${collection}`,
          queryBuilder.filter ? aql`FILTER`: aql``,
          queryBuilder.filter,
          aql.literal(`${fOpt}`),
          aql`doc WITH ${data} IN ${collection}`,
          aql`LET changed = NEW`,
          queryBuilder.returnFilter,
        ],
        " "
      );
    }
    return this._returnMap(database, query, `No record found for id '${id}'`, true, false, params.transaction);
  }

  public async update(
    id: NullableId | NullableId[],
    data: Partial<any>,
    params: Params
  ) {
    return this._replaceOrPatch("REPLACE", id, data, params);
  }

  public async patch(
    id: NullableId | NullableId[],
    data: Partial<any>,
    params: Params
  ) {
    return this._replaceOrPatch("UPDATE", id, data, params);
  }

  public async remove(id: NullableId | NullableId[], params: Params) {
    // Eliminate null or empty clauses
    const ids: NullableId[] = Array.isArray(id) ? id : [id];
    // Setup connection & verify
    const { database, collection } = await this.connect();
    if (!database) {
      throw new Error("Database not initialized");
    }
    if (!collection) {
      throw new Error("Collection not initialized");
    }
    // Build query
    let query: AqlQuery;
    const queryBuilder = new QueryBuilder(params, "doc", "removed");
    if (id && (!Array.isArray(id) || (Array.isArray(id) && id.length > 0))) {
      query = aql`
        FOR doc IN ${ids}
          REMOVE doc IN ${collection}
          LET removed = OLD
          ${queryBuilder.returnFilter}
      `;
    } else {
      query = aql.join(
        [
          aql`FOR doc IN ${collection}`,
          queryBuilder.filter ? aql`FILTER`: aql``,
          queryBuilder.filter,
          aql`REMOVE doc IN ${collection}`,
          aql`LET removed = OLD`,
          queryBuilder.returnFilter,
        ],
        " "
      );
    }

    return this._returnMap(database, query, undefined, true, false, params.transaction);
  }

  public async setup(app: Application, path: string) {
    await this.connect();
  }
}

export default function ArangoDbService<T>(
  options: IOptions
): DbService<T> | any {
  return new DbService<T>(options);
}
