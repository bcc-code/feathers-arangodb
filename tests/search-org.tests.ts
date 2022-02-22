import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { expect } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";

const serviceName = "org";

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
    await new Promise((res) => setTimeout(res, 1000))
  });

  it("Search - org by name", async () => {
    const results = await service.find({ query: { $search: 'Oslo' }, $select: ['name'] });
    expect(results[0]._id).to.eq("org/69");
  });

  it("Search - org by ID", async () => {
    const results = await service.find({ query: { $search: '69' }, $select: ['name'] });
    expect(results[0]._id).to.eq("org/69");
  });

});
