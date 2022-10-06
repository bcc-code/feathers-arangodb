import 'mocha'
import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { assert } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";

const serviceName = "membership-status-read";
let testUser: any = null;
describe(`Search & Query tests on the ${serviceName} service `,async () => {
  let app: Application<any>;
  let service: IArangoDbService<any>;

  before(async () => {
    await importDB()
    app = feathers();
    app.use(
      `/${serviceName}`,
      ArangoDbService({
        collection: 'membership_status_read',
        view: 'membership_status_read_view',
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
    testUser = await service.get('53182', {});
    await new Promise((res) => setTimeout(res, 1000))
  });

  it("Search - Applicant name", async () => {
    try {
      const results = await service.find({ query: { $search: 'Cloia Jerrits' } });
      assert.equal(results[0].applicantID, testUser.applicantID);
    } catch(err) {
      assert.fail(err.message)
    }
  });

  it("Search - Applicant name typo", async () => {
    try {
      const results = await service.find({ query: { $search: 'Cloie Gerrits' } });
      assert.equal(results[0].applicantID, testUser.applicantID);
    } catch(err) {
      assert.fail(err.message)
    }
  });

  it("Search - ApplicantID", async () => {
    try {
      const results = await service.find({ query: { $search: testUser.applicantID } });
      assert.equal(results[0].applicantID, testUser.applicantID);
    } catch(err) {
      assert.fail(err.message)
    }
  });
});

