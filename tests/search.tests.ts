import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { expect } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";

const serviceName = "person";
let testUser: any = null;
let specialCharactersUser: any = null;
describe(`Feathers search tests on the ${serviceName} service `, () => {
  let app: Application<any>;
  let service: IArangoDbService<any>;

  before(async () => {
    //await importDB();
    app = feathers();
    app.use(
      `/${serviceName}`,
      ArangoDbService({
        collection: 'person',
        view: 'person_view',
        database: "TEST",
        authType: AUTH_TYPES.BASIC_AUTH,
        username: "root",
        password: "",
        dbConfig: {
          url: "http://localhost:8529",
        }
      })
    );
    service = <IArangoDbService<any>>app.service(serviceName);
    testUser = await service.get('178494230', {});
    specialCharactersUser = await service.get('430126186', {});
  });
  
  it("Search - PersonID", async () => {
    const results = await service.find({ query: { $search: testUser.personID } });
    expect(results[0].personID).to.eq(testUser.personID);
  });

  it("Search - Email", async () => {
    const results = await service.find({ query: { $search: testUser.email } });
    expect(results[0].personID).to.eq(testUser.personID);
  });

  it("Search - Full name no error", async () => {
    const results = await service.find({ query: { $search: testUser.displayName } });
    expect(results[0].personID).to.eq(testUser.personID);
  });

  it("Search - Case insensitive uppercase", async () => {
    const results = await service.find({ query: { $search: testUser.displayName.toUpperCase() } });
    expect(results[0].personID).to.eq(testUser.personID);
  });
  
  it("Search - Case insensitive lowercase", async () => {
    const results = await service.find({ query: { $search: testUser.displayName.toLowerCase() } });
    expect(results[0].personID).to.eq(testUser.personID);
  });

  //With characters off, we can't expect to have it as the highest ranked result
  it("Search - Full name one character off", async () => {
    const results = await service.find({ query: { $search: testUser.name1off } });
    expect(results.some((el: any) => el.personID == testUser.personID)).to.be.true
  });

  it("Search - Full name two characters off", async () => {
    const results = await service.find({ query: { $search: testUser.name2off } });
    expect(results.some((el: any) => el.personID == testUser.personID)).to.be.true
  });

  it("Search - Full name with special characters", async () => {
    const results = await service.find({ query: { $search: specialCharactersUser.nameNoAccents } });
    expect(results.some((el: any) => el.personID == specialCharactersUser.personID)).to.be.true
  });
});
