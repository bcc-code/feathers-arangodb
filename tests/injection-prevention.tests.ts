import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { expect } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";

const serviceName = "org";
let testUserWithARole: any = null;

describe(`Aql injection prevention tests `, () => {
  let app: Application<any>;
  let service: IArangoDbService<any>;

  before(async () => {
    //await importDB()
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

  it.only("AQL injection on select is detected and not let through", async () => {
    const standardQueryResults = await service.find({ query: { $select: ['_id', 'profileVisibility'] } });
    const results = await service.find({ query: { $select: ["profileVisibility\": 0, \"church\":doc }//"]},});
    expect(results[0]._id).to.eq(standardQueryResults[0]._id);
  });

  it.skip("Modified query gets all data from the system", async () => {
    const results = await service.find( {"$sort":{"profileVisibility : 1 RETURN { \"church\": doc, \"profileVisibility\": 0 //}":1}} );
    console.log(results)
    expect(results[0]._id).to.eq("person/430126187");
  });

  it.skip("Modified query gets all data from the system v2", async () => {
    const results = await service.get("430126187", {"profileVisibility != @value1 RETURN { data: doc, _key: @value2 }//":7} );
    console.log(results)
    expect(results._id).to.eq("person/430126187");
  });

});
