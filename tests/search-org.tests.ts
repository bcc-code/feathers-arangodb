import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { expect } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";

const serviceName = "org";
let testUserWithARole: any = null;

describe(`Search tests on the ${serviceName} service `, () => {
  let app: Application<any>;
  let service: IArangoDbService<any>;

  before(async () => {
    await importDB()
    app = feathers();
    app.use(
      `/${serviceName}`,
      ArangoDbService({
        collection: 'org',
        view: 'org_view',
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
    //testUserWithARole = await service.get('178509735', {});

  });

  it("Search - org", async () => {
    const results = await service.find({ query: { $search: 'Oslo' } });
    expect(results[0]._id).to.eq("org/178376299");
  });

});
