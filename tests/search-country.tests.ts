import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { expect } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";

const serviceName = "country";

describe(`Search tests on the ${serviceName} service `, () => {
  let app: Application<any>;
  let service: IArangoDbService<any>;

  before(async () => {
    await importDB()
    app = feathers();
    app.use(
      `/${serviceName}`,
      ArangoDbService({
        collection: 'country',
        view: 'country_view',
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
    await new Promise((res) => setTimeout(res, 1000))

  });

  it("Search - country by name", async () => {
    const results = await service.find({ query: { $search: 'norway' } });
    expect(results[0]._id).to.eq("country/53");
  });

  it("Search - country by id", async () => {
    const results = await service.find({ query: { $search: 53 } });
    expect(results[0]._id).to.eq("country/53");
  });


});
