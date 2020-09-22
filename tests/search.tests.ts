require('dotenv').config();
import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";

const serviceName = "person";
const testUser = JSON.parse(process.env.TEST_USER as string)
const specialCharactersUser = JSON.parse(process.env.TEST_USER_SPECIAL_CHARACTERS as string)

describe(`Feathers search tests on the ${serviceName} service `, () => {
  let app: Application<any>;
  let service: IArangoDbService<any>;


  beforeAll(async () => {
    app = feathers();
    app.use(
      `/${serviceName}`,
      ArangoDbService({
        collection: 'person',
        view: 'person_view',
        database: process.env.BCC_MEMBERS_ARANGODB_DATABASE as string,
        authType: AUTH_TYPES.BASIC_AUTH,
        username: process.env.BCC_MEMBERS_ARANGODB_USERNAME as string,
        password: process.env.BCC_MEMBERS_ARANGODB_PASSWORD as string,
        dbConfig: {
          url: process.env.BCC_MEMBERS_ARANGODB_URL as string,
        },
      })
    );
    service = <IArangoDbService<any>>app.service(serviceName);
  });

  it("Service connects", async () => {
    await service.connect();
    expect(service.database).toBeDefined();
    expect(service.collection).toBeDefined();
  });

  it("Service setup check", async () => {
    await service.setup();
    expect(service.database).toBeDefined();
    expect(service.collection).toBeDefined();
  });

  it("Search - PersonID", async () => {
    const results = await service.find({ query: { $search: testUser.personID } });
    expect(results[0].personID).toEqual(testUser.personID);
  });

  it("Search - Email", async () => {
    const results = await service.find({ query: { $search: testUser.email } });
    expect(results[0].personID).toEqual(testUser.personID);
  });

  it("Search - Full name no error", async () => {
    const results = await service.find({ query: { $search: testUser.name } });
    expect(results[0].personID).toEqual(testUser.personID);
  });

  it("Search - Case insensitive uppercase", async () => {
    const results = await service.find({ query: { $search: testUser.name.toUpperCase() } });
    expect(results[0].personID).toEqual(testUser.personID);
  });
  
  it("Search - Case insensitive lowercase", async () => {
    const results = await service.find({ query: { $search: testUser.name.toLowerCase() } });
    expect(results[0].personID).toEqual(testUser.personID);
  });

  //With characters off, we can't expect to have it as the highest ranked result
  it("Search - Full name one character off", async () => {
    const results = await service.find({ query: { $search: testUser.name1off } });
    expect(results.some((el: any) => el.personID == testUser.personID)).toBeTruthy
  });

  it("Search - Full name two characters off", async () => {
    const results = await service.find({ query: { $search: testUser.name2off } });
    expect(results.some((el: any) => el.personID == testUser.personID)).toBeTruthy
  });

  it("Search - Full name with special characters", async () => {
    const results = await service.find({ query: { $search: specialCharactersUser.name } });
    expect(results.some((el: any) => el.personID == specialCharactersUser.personID)).toBeTruthy
  });
});
