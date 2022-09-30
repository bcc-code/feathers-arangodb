import feathers from '@feathersjs/feathers';
import { aql } from 'arangojs';
import { AqlQuery } from 'arangojs/aql';
import { ArangoError } from 'arangojs/error';
import ArangoDbService, { IArangoDbService, AUTH_TYPES, DbService } from '../src';
import { AutoDatabse } from '../src/auto-database';

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
        db = new AutoDatabse({
            databaseName: testDatabase,
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

    async function queryWithRetry(query: AqlQuery, id: string) {
        console.log('Runniong query', id)
        const res = await db.query(query).catch(err => {
            if(err instanceof ArangoError && err.errorNum === 1200) {
                console.log('  Retrying on write-write conflict', id)
                return queryWithRetry(query, id);
            }
            throw err
        })
        console.log("  Finished query", id)
    }

    it.only("Two requests at the same time don't cause an error", async () => {
        const updateQuery = aql`
        for t in TEST_COL
            let v = JSON_PARSE("{ \"quiz\": {\"sport\": {\"q1\": {\"question\": \"Which one is correct team name in NBA?\",\"options\": [\"New York Bulls\",\"Los Angeles Kings\",\"Golden State Warriros\",\"Huston Rocket\"],\"answer\": \"Huston Rocket\"}},\"maths\": {\"q1\": {\"question\": \"5 + 7 = ?\",\"options\": [\"10\",\"11\",\"12\",\"13\"],\"answer\": \"12\"},\"q2\": {\"question\": \"12 - 8 = ?\",\"options\": [\"1\",\"2\",\"3\",\"4\"],\"answer\": \"4\"}}}}")
            update t with {
                name: "Doug2",
                a: v,
                b: 'abc',
                o: 'abc',
                h: 'abc',
                g: 'abc', 
                f: 'abc',
                e: 'abc',
                d: 'abc',
                c: 'abc',
            } in TEST_COL`
        const promises:Promise<any>[] = []
        for(let i = 0; i < 10; i++) {
            promises.push(queryWithRetry(updateQuery, i.toString()))
        }
        await Promise.all(promises);
        // service.patch(_ids.Doug, {name: `Doug-1`}, {})
        // service.patch(_ids.Doug, {name: `Doug-2`}, {})
        // const res = await cursor.map(r => r);
        // console.log(res);
        // const promises:Promise<any>[] = []
        // promises.push(service.patch(_ids.Doug, {name: `Doug-1`}, {}))
        // const results = await Promise.allSettled(promises)
        // const rejectedCount = results.filter(r => r.status == "rejected").length
        // console.log(rejectedCount);
    });
})
