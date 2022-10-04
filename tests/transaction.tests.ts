import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { Database } from "arangojs";
import { assert } from "chai";
import ArangoDbService, { AUTH_TYPES, IArangoDbService } from "../src";
import { AutoDatabse } from "../src/auto-database";

describe(`Tests for added transaction functionality`, () => {
    const testDatabase = 'TEST_DB';
    const testCollection = 'TEST_COL';
    const testUser = 'root';
    const testPass = 'root';
    let app: Application | any;
    let service: IArangoDbService<any>;
    let _ids: any = {};
    let db: Database;
  
    before(async () => {
        db = new AutoDatabse({
            url: 'http://localhost:8529',
            databaseName: testDatabase
        });
        db.useBasicAuth(testUser, testPass)
        app = feathers();
        app.use(
            `/test`,
            ArangoDbService({
                id: '_key',
                collection: testCollection,
                database: db,
            })
        );
        service = <IArangoDbService<any>>app.service('test');
    });
  
    beforeEach(async () => {
        const data: any = await service.create({
            name: 'Doug',
            age: 32
        });
        _ids.Doug = data._key;
        const data2: any = await service.create({
            name: 'Bob',
            age: 32
        });
        _ids.Doug = data._key;
        _ids.Bob = data2._key;
    });

    afterEach(async() => {
        await service.remove(_ids.Doug).catch(() => {});
        await service.remove(_ids.Bob).catch(() => {});
    })

    it.only("Successful transaction updates data", async () => {
        const col = db.collection(testCollection);
        const transaction = await db.beginTransaction({write: [col]})
        const intermediateResult = await service.patch(_ids.Doug, {
            name: "Doug 2",
        },{
            transaction
        }) as any
        assert.equal(intermediateResult.name, "Doug 2")
        await service.patch(_ids.Bob, {
            name: "Bob 2",
        },{
            transaction
        })
        const res = await transaction.commit()
        assert.equal( res.status, 'committed');
        const bob = await service.get(_ids.Bob);
        const doug = await service.get(_ids.Doug);
        assert.equal(bob.name, "Bob 2");
        assert.equal(doug.name, "Doug 2");
    })

    it.only("Aborted transaction doesn't update data", async () => {
        const col = db.collection(testCollection);
        const transaction = await db.beginTransaction({write: [col]})
        const intermediateResult = await service.patch(_ids.Doug, {
            name: "Doug 2",
        },{
            transaction
        }) as any
        assert.equal(intermediateResult.name, "Doug 2")
        await service.patch(_ids.Bob, {
            name: "Bob 2",
        },{
            transaction
        })
        const res = await transaction.abort()
        assert.equal(res.status, 'aborted');
        const bob = await service.get(_ids.Bob);
        const doug = await service.get(_ids.Doug);
        assert.equal(bob.name, "Bob");
        assert.equal(doug.name, "Doug");
    })
});
  
