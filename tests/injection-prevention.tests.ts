import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { assert, expect } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";

const serviceName = "person";

/* Aql injection works by adding comment characters to 'turn-off' return statement that QueryBuilder produces
and by supplying own version of return by using string termination techniques.
example:
standard query: { query: {"displayName": {"$net":1}}}
query: { query: {"displayName != @value1 RETURN { church: doc, _key: \'178495328\' }//":"!"}}
expected AQL: "FOR doc in @@value0  FILTER  doc.displayName == @value1   RETURN doc"
malicious AQL: "FOR doc in @@value0  FILTER  doc.displayName != @value1 RETURN { church: doc, _key: '178495328' }// == @value1   RETURN doc"
*/
describe(`Aql injection prevention tests `, () => {
  let app: Application<any>;
  let service: IArangoDbService<any>;

  before(async () => {
    await importDB()
  })

  beforeEach(async () => {
    app = feathers();
    app.use(
      `/${serviceName}`,
      ArangoDbService({
        collection: 'person',
        view: 'person_view',
        database: "TEST",
        authType: AUTH_TYPES.BASIC_AUTH,
        username: "root",
        password: "root",
        dbConfig: {
          url: "http://localhost:8529",
        }
      })
    );
    service = <IArangoDbService<any>>app.service(serviceName);

  });

  it("AQL injection on find with filter is parameterized and treated as any other query", async () => {
    const results = await service.find( { query: {"displayName != @value1 RETURN { church: doc, _key: \'178495328\' }//":"!"}} );
    expect(results).to.be.an('array')
    expect(results.length).to.be.equal(0)
  });

  it("AQL injection of REMOVE is detected and not let through", async () => {
    const results = await service.find({query: {"displayName != @value1 REMOVE doc IN person//":"!"}} );
    expect(results).to.be.an('array')
    expect(results.length).to.be.equal(0)

    const foundEntities = await service.find();
    expect(foundEntities.length).to.be.greaterThan(0);
  });

  it("AQL injection on get with filter is detected and not let through", async () => {
    try {
      const results = await service.get("44722", {query: {"@value2 RETURN doc//":{"$nin":[""]}}} );
      assert.fail("Query shouldn't find any records")
    } catch (err) {
      expect(err.message.includes('No record found for id'))
    }
  });

  it("AQL injection on get with filter is detected and not let through, example 3", async () => {
    const results = await service.get("44722", {query: {"@value2 RETURN doc//":{"$nin":[""]}}} );
    expect(results).to.not.be.an('array')
  });

  it("Aql injection on search is detected and not let through", async () => {
    const results = await service.find({query: {"$search":"\'\'\')) OR doc.a != 1 LIMIT 0,1 UPDATE { _key: \'178509735\', activeRole: \'Developer\' } IN person RETURN {}//\'"}});
      
    expect(results).to.be.an('array')
    expect(results.length).to.be.equal(0)
  })

  it('Aql injection on create authentication', async () => {
    const authServiceName = 'authentication';
    app = feathers();
    app.use(
      `/${authServiceName}`,
      ArangoDbService({
        collection: 'authentication',
        database: "TEST",
        authType: AUTH_TYPES.BASIC_AUTH,
        username: "root",
        password: "root",
        dbConfig: {
          url: "http://localhost:8529",
        }
      })
    );
    service = <IArangoDbService<any>>app.service(serviceName);

    try {
      const results = await service.create({query: {"strategy": "apiKey", "token": {"_key!=@value1/:**:/RETURN/:**:/doc/:/":1}}});
    } catch (error) {
      expect(error.name === "ArangoError")
      expect(error.code === 400)
      return;
    }
    assert.fail("Malicious query should result in ArangoError.")
  })
});
