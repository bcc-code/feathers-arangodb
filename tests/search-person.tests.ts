import 'mocha'
import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { assert, expect } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";
import { checkError } from './utils';

const serviceName = "person";
let testUser: any = null;
let specialCharactersUser: any = null;
let userWithMiddleName: any = null;
describe(`Search & Query tests on the ${serviceName} service `,async () => {
  let app: Application<any>;
  let service: IArangoDbService<any>;

  before(async () => {
    await importDB()
    app = feathers();
    app.use(
      `/${serviceName}`,
      ArangoDbService({
        collection: 'person',
        view: 'person_view',
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
    specialCharactersUser = await service.get('42352', {});
    userWithMiddleName = await service.get('13629', {});
    await new Promise((res) => setTimeout(res, 1000))
  });

  it("Search - invalid input => null", async () => {
    try {
      const results = await service.find({ query: { $search: null} });
      assert.fail("Invalid input should result in error");
    } catch (err: unknown) {
      checkError(err, 'Invalid query type');
    }
  });

  it("Search - invalid input => object", async () => {
    try {

      const results = await service.find({ query: { $search: {displayName: "Cloia Jerrits"}} });
      assert.fail("Invalid input should result in error");
    } catch (err: unknown) {
      checkError(err, 'Invalid query type');
    }
  });


  it("Search - PersonID", async () => {
    const results = await service.find({ query: { $search: 'Cloia Jerrits' } });
    expect(results[0].personID).to.eq(testUser.personID);
  });

  it("Search - Email", async () => {
    const results = await service.find({ query: { $search: testUser.email } });
    expect(results[0].personID).to.eq(testUser.personID);
  });

  it("Search - Full name no error", async () => {
    const results = await service.find({ query: { $search: testUser.displayName } });
    expect(results[0]?.personID).to.eq(testUser.personID);
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

  it("Search - With middle name given only first 4 letter of first and lastname", async () => {
    const results = await service.find({ query: { $search: 'bat dal' } });
    expect(results.some((el: any) => el.personID == userWithMiddleName.personID)).to.be.true
  });

  it("Search - exact match (contains)", async () => {
    const results = await service.find({ query: { $search: '"Thomas Sebat"' } });
    expect(results[0].displayName == "Thomas Sebat").to.be.true
  });

  it("Search with filter", async() => {
    const results = await service.find({query: { $search: 'daly', gender: "Male"}})
    expect(results.length).to.eq(3)
    const displayNames = results.map(r => r.displayName)
    expect(displayNames).to.contain("Philly Daly")
    expect(displayNames).to.contain("Ozzie Daly")
    expect(displayNames).to.contain("Freek Daly")
  })

  it("Search by middle name", async() => {
    const results = await service.find({query: { $search: 'wife of philly'}})
    expect(results[0].displayName).to.eq('Batie Sofa Daly')
  })

  it("Search by last name", async() => {
    const results = await service.find({query: { $search: 'jerrits'}})
    console.log(results.map(r => r.searchValue))
    expect(results[0].lastName).to.eq('Jerrits')
  })
  it("search by last name typo", async() => {
    const results = await service.find({query: { $search: 'gerrits'}})
    expect(results[0].lastName).to.eq('Jerrits')
  })
  it("search by last name two letter", async() => {
    const results = await service.find({query: { $search: 'da'}})
    expect(results[0].lastName).to.eq('Daly')
  })
  it("Search - country and church filter simultaneously", async () => {
    const results = await service.find({ 
      query: {
        churchID: {
          $in: [
            69
          ]
        },
        currentAddress: {
          country: {
            _id: {
              $in: [
                'country/53'
              ]
            }
          }
        }
      }
    });
    expect(results.length > 0).to.be.true
  });
});

