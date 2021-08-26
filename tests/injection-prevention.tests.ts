import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { assert, expect } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";

const serviceName = "person";
let testUserWithARole: any = null;

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
    app = feathers();
    app.use(
      `/${serviceName}`,
      ArangoDbService({
        collection: 'person',
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

  it("AQL injection on find with select is detected and not let through", async () => {
    let maliciousQueryResults = {};
    try {
        maliciousQueryResults = await service.find({ query: { $select: ["_id", 'profileVisibility\":0,\"church\":doc}//']},});
    } catch (error) {
        expect(error.name === "ArangoError")
        expect(error.code === 400)
        return;
    }
    assert.fail("Malicious query should result in ArangoError")
  });

  it("AQL injection on find with sort is detected and not let through", async () => {
    const results = await service.find( { query: {$sort:{'profileVisibility RETURN { \"church\": doc, \"profileVisibility\": 0 }//':1}}} );
    expect(results[0]).to.not.have.property('profileVisibility')
  });

  it("AQL injection on find with filter is detected and not let through", async () => {
    const results = await service.find( { query: {"displayName != @value1 RETURN { church: doc, _key: \'178495328\' }//":"!"}} );
    expect(results).to.be.an('array')
    expect(results.length).to.be.equal(0)
  });

  it("AQL injection on find with filter is detected and not let through, example 2", async () => {
    try {
        const results = await service.find({query: {"_key=='178495328'/**/LET/**/activeRole='Developer'/**/UPDATE/**/doc/**/WITH/**/{activeRole}/**/IN/**/person/**/LET/**/asd=1":{"$not":" "},"$limit":-1,"$skip":0} });
    } catch (error) {
        expect(error.name === "ArangoError")
        expect(error.code === 400)
        return;
    }
    assert.fail("Malicious query should result in ArangoError")
  });

  it("AQL injection of REMOVE is detected and not let through", async () => {
    const results = await service.find({query: {"displayName != @value1 REMOVE doc IN person//":"!"}} );
    expect(results).to.be.an('array')
    expect(results.length).to.be.equal(0)

    const foundEntities = await service.find();
    expect(foundEntities.length).to.be.greaterThan(0);
  });

  it("AQL injection on get with filter is detected and not let through", async () => {
    const results = await service.get("178495328", {query: {"profileVisibility != @value1 RETURN { data: doc, _key: @value2 }//":1}} );
    expect(results).to.not.be.an('array')
  });

  it("AQL injection on get with filter is detected and not let through, example 2", async () => {
    const results = await service.get("178495328", {query: {"@value2 RETURN doc//":{"$nin":[""]}}} );
    expect(results).to.not.be.an('array')
  });

  it("AQL injection on get with filter is detected and not let through, example 3", async () => {
    const results = await service.get("178495328", {query: {"@value2 RETURN doc//":{"$nin":[""]}}} );
    expect(results).to.not.be.an('array')
  });

});
