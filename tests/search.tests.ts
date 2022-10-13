import feathers from '@feathersjs/feathers';
import { Application } from 'feathersjs__feathers';
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from '../src';
import { Database } from 'arangojs';
import prepareDbForSearch from './setup-tests/prepareDbForSearch';
import { assert } from 'chai';

describe(`Feathers search tests`, () => {
    const databaseName = "TEST_SEARCH_DB"
    const testCollection = 'TEST_COL';
    const testView = 'TEST_VIEW';
    const serviceName = 'test';

    let app: Application | any;
    let service: IArangoDbService<any>;
    let systemDb: Database;
    let db: Database;

    before(async () => {
        app = feathers();
        systemDb = new Database();
        db = await prepareDbForSearch(systemDb, databaseName, testCollection, testView);

        app.use(
        `/${serviceName}`,
        ArangoDbService({
            id: "_key",
            collection: testCollection,
            view: testView,
            database: databaseName,
            searchFields: [
                {name: "name", isFuzzy: true, type: "string"},
                {name: "email", isFuzzy: false, type: "string"},
                {name: "age", isFuzzy: false, type: "number"},
            ],
            events: ['testing'],
            authType: AUTH_TYPES.BASIC_AUTH,
            username: "root",
            password: "root",
        })
        );
        service = <IArangoDbService<any>>app.service(serviceName);
        await service.create([
            {name: 'John Doe', email: "john.doe@example.com", age: 32},
            {name: 'Mary Doe', email: "mary.doe@example.com", age: 30},
            {name: 'Alex Doe', email: "alex.doe@example.com", age: 5},
            {name: 'Kate Doe', email: "kate.doe@example.com", age: 4},

            {name: 'Adam Harry Smith', email: "adam@example.com", age: 12},
            {name: 'Bob Harry Smith', email: "bob@example.com", age: 13},
        ]);

        await new Promise(res => setTimeout(res, 2000)); // Wait for view creation
    });

    after(async () => {
        systemDb.dropDatabase(databaseName)
    })

    it("Fuzzy search for last name", async() => {
        const res = await service.find({
            query: {
                $search: "Doe"
            }
        })
        assert.equal(res.length, 4)
    })

    it("Fuzzy search for full name", async() => {
        const res = await service.find({
            query: {
                $search: "John Doe"
            }
        })
        assert.equal(res.length, 1)
        assert.equal(res[0].name, "John Doe")
    })

    it("Fuzzy search with filter", async() => {
        const res = await service.find({
            query: {
                $search: "Doe",
                age: {$gt: 20},
            }
        })
        assert.equal(res.length, 2)
    })

    it("Fuzzy search for name with typo", async() => {
        const res = await service.find({
            query: {
                $search: "Jon Don"
            }
        })
        assert.equal(res.length, 1)
        assert.equal(res[0].name, "John Doe")
    })

    it("Exact search for full name with typo", async() => {
        const res = await service.find({
            query: {
                $search: "\"Jon Don\""
            }
        })
        assert.equal(res.length, 0)
    })
    it("Exact search for firstName", async() => {
        const res = await service.find({
            query: {
                $search: "\"John\""
            }
        })
        assert.equal(res.length, 1)
        assert.equal(res[0].name, "John Doe")
    })
    it("Exact search for firstName", async() => {
        const res = await service.find({
            query: {
                $search: "\"John\""
            }
        })
        assert.equal(res.length, 1)
        assert.equal(res[0].name, "John Doe")
    })
    it("Equality search for string", async() => {
        const res = await service.find({
            query: {
                $search: "john.doe@example.com"
            }
        })
        assert.equal(res.length, 1)
        assert.equal(res[0].name, "John Doe")
    })  
    it("Equality search for string with typo", async() => {
        const res = await service.find({
            query: {
                $search: "jon.don@example.com"
            }
        })
        assert.equal(res.length, 0)
    })
    it("Equality search for number", async() => {
        const res = await service.find({
            query: {
                $search: 32
            }
        })
        assert.equal(res.length, 1)
        assert.equal(res[0].name, "John Doe")
    })  
    it("Equality search for number with typo", async() => {
        const res = await service.find({
            query: {
                $search: 31
            }
        })
        assert.equal(res.length, 0)
    })
    it("Ignore sort when searching", async() => {
        const res = await service.find({
            query: {
                $search: "Bob Harry Smith",
                $sort: {
                    name: 1
                }
            }
        })
        assert.equal(res.length, 2);
        assert.equal(res[0].name, "Bob Harry Smith")
        assert.equal(res[1].name, "Adam Harry Smith")
    })  
})
