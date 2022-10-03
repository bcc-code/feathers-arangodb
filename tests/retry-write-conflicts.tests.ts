import feathers from '@feathersjs/feathers';
import { aql } from 'arangojs';
import { AqlQuery } from 'arangojs/aql';
import { isArangoError } from 'arangojs/error';
import { assert } from 'chai';
import ArangoDbService, { IArangoDbService, AUTH_TYPES, DbService } from '../src';
import { AutoDatabse } from '../src/auto-database';
import { RetryDatabase }from '../src/retry-database'

const idProp = '_key';

describe(`Write-write conflict prevention tests`, () => {
    const testDatabase = 'TEST_DB';
    const testCollection = 'TEST_COL';
    const testUser = 'root';
    const testPass = 'root';
    let service: IArangoDbService<{name: string, age: number}>;
    let _ids: Record<string, string> = {};
    let db: AutoDatabse;
    before(async () => {
        db = new RetryDatabase({
            databaseName: testDatabase,
            agentOptions: {
                maxSockets: 3
            },
            retryOnConflict: 2
        })
        db.useBasicAuth(testUser, testPass);
        const app = feathers();
        app.use(
          `/test`,
          ArangoDbService({
            id: idProp,
            collection: testCollection,
            database: testDatabase,
            authType: AUTH_TYPES.BASIC_AUTH,
            username: testUser,
            password: testPass,
          })
        );
        service = <IArangoDbService<any>>app.service('test');
    });

    beforeEach(async () => {
        const data = await service.create({
            name: 'Doug',
            age: 32
        }, {});
        _ids.Doug = data[idProp];
    });

    afterEach(async () => {
        await service.remove(_ids.Doug, {});
        delete _ids.Doug
    })

    function getQuery(n: number):AqlQuery {
        return aql`
        for t in TEST_COL
        update t with {
            name: "Doug2",
            b: ${n}, 
        } in TEST_COL`
    }

    it("Two requests at the same time don't cause an error", async () => {
        const promises:Promise<any>[] = []
        for(let i = 0; i < 5; i++) {
            promises.push(db.query(getQuery(i)))
        }
        await Promise.all(promises);
    });

    it("Can overwrite the limit locally", async () => {
        const promises:Promise<any>[] = []
        for(let i = 0; i < 5; i++) {
            promises.push(db.query(getQuery(i), {retryOnConflict: 0}))
        }
        try {
            await Promise.all(promises);
            assert.fail("Should fail")
        } catch(err) {
            if(isArangoError(err))
                assert.equal(err.errorNum, 1200)
            else 
                assert.fail("Incorrect error")
        }
    });
})
