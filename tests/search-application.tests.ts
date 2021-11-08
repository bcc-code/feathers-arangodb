import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { expect } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";

describe(`Search tests on the application service `, () => {
  let app: Application<any>;
  let service: IArangoDbService<any>;

  before(async () => {
    await importDB()
    app = feathers();
    app.use(
      `/application`,
      ArangoDbService({
        collection: 'application',
        view: 'application_view',
        database: "TEST",
        authType: AUTH_TYPES.BASIC_AUTH,
        username: "root",
        password: "root",
        dbConfig: {
          url: "http://localhost:8529",
        }
      })
    );
    service = <IArangoDbService<any>>app.service('application');
    await new Promise((res) => setTimeout(res, 1000))

  });

  it("Search - application", async () => {
    const results = await service.find({ query: { $search: 'Samvirk' } });
    expect(results[0]._id).to.eq("application/522409136");
  });

});
