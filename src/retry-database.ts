import { AqlLiteral, AqlQuery, isAqlLiteral, isAqlQuery } from "arangojs/aql";
import { Config, Connection } from "arangojs/connection";
import { ArrayCursor } from "arangojs/cursor";
import { QueryOptions } from "arangojs/database";
import { isSystemError } from "arangojs/error";
import { Errback } from "arangojs/lib/errback";
import { ArangojsResponse } from "arangojs/lib/request.node";
import { AutoDatabse } from "./auto-database";

export interface RetryDatabaseConfig extends Config {
    retryOnConflict?: number;
}

export class RetryDatabase extends AutoDatabse {
    retryOnConflict: number; 
    constructor(config?: RetryDatabaseConfig) {
      super(config);
      this.retryOnConflict = config?.retryOnConflict ?? 0
      this._connection = new RetryConnection(config);
    }

    query<T = any>(
        query: AqlQuery,
        options?: QueryOptions
      ): Promise<ArrayCursor<T>>;
    query<T = any>(
        query: string | AqlLiteral,
        bindVars?: Record<string, any>,
        options?: QueryOptions
      ): Promise<ArrayCursor<T>>;
    query<T = any>(
        query: string | AqlQuery | AqlLiteral,
        bindVars?: Record<string, any>,
        options: QueryOptions = {}
      ): Promise<ArrayCursor<T>> {
        if (isAqlQuery(query)) {
            options = bindVars ?? {};
            bindVars = query.bindVars;
            query = query.query;
        } else if (isAqlLiteral(query)) {
            query = query.toAQL();
        }
        options.retryOnConflict = options.retryOnConflict ?? this.retryOnConflict
        return super.query(query, bindVars, options)
    }
}

export class RetryConnection extends Connection {
    protected _runQueue(): void {
        if (!this._queue.length || this._activeTasks >= this._maxTasks)
            return;
        const task = this._queue.shift();
        if(!task) return;
        let host = this._activeHost;
        if (task.host !== undefined) {
            host = task.host;
        }
        else if (task.allowDirtyRead) {
            host = this._activeDirtyHost;
            this._activeDirtyHost = (this._activeDirtyHost + 1) % this._hosts.length;
            task.options.headers["x-arango-allow-dirty-read"] = "true";
        }
        else if (this._loadBalancingStrategy === "ROUND_ROBIN") {
            this._activeHost = (this._activeHost + 1) % this._hosts.length;
        }
        this._activeTasks += 1;
        const callback: Errback<ArangojsResponse> = (err, res) => {
            this._activeTasks -= 1;
            if (err) {
                if (!task.allowDirtyRead &&
                    this._hosts.length > 1 &&
                    this._activeHost === host &&
                    this._useFailOver) {
                    this._activeHost = (this._activeHost + 1) % this._hosts.length;
                }
                else if (!task.host &&
                    this._shouldRetry &&
                    task.retries < (this._maxRetries || this._hosts.length - 1) &&
                    isSystemError(err) &&
                    err.syscall === "connect" &&
                    err.code === "ECONNREFUSED") {
                    task.retries += 1;
                    this._queue.push(task);
                }
                else {
                    if (task.stack) {
                        err.stack += task.stack();
                    }
                    task.reject(err);
                }
            }
            else {
                const response = res;
                if(!response) return;
                if (response.statusCode === 409 && task.retryOnConflict > 0) {
                    task.retryOnConflict -= 1;
                    this._queue.push(task);
                }
                else if (response.statusCode === 503 &&
                    response.headers["x-arango-endpoint"]) {
                    const url = response.headers["x-arango-endpoint"];
                    const [index] = this.addToHostList(url);
                    task.host = index;
                    if (this._activeHost === host) {
                        this._activeHost = index;
                    }
                    this._queue.push(task);
                }
                else {
                    response.arangojsHostId = host;
                    task.resolve(response);
                }
            }
            this._runQueue();
        };
        try {
            this._hosts[host](task.options, callback);
        }
        catch (e) {
            if(e instanceof Error)
                callback(e);
        }
    }
}
