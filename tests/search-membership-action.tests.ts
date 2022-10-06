import 'mocha'
import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { assert } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";

const serviceName = "membership-action-read";
describe(`Search & Query tests on the ${serviceName} service `,async () => {
  let app: Application<any>;
  let service: IArangoDbService<any>;

  before(async () => {
    await importDB()
    app = feathers();
    app.use(
      `/${serviceName}`,
      ArangoDbService({
        collection: 'membership_action_read',
        view: 'membership_action_read_view',
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

  it("Search - Applicant name", async () => {
    try {
      const results = await service.find({ query: { $search: 'Batie Sofa Daly' } });
      assert.equal(results[0]?.applicantID, '13629');
    } catch(err) {
      assert.fail(err.message)
    }
  });

  it("Search - Applicant name typo", async () => {
    try {
      const results = await service.find({ query: { $search: 'Bat Dal' } });
      assert.equal(results[0]?.applicantID, '13629');
    } catch(err) {
      assert.fail(err.message)
    }
  });

  it("Search - ApplicantID", async () => {
    try {
      const results = await service.find({ query: { $search: 13629 } });
      assert.equal(results[0]?.applicantID, '13629');
    } catch(err) {
      assert.fail(err.message)
    }
  });
});

