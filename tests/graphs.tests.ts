import feathers from "@feathersjs/feathers";
import { Application } from "@feathersjs/feathers";
import { expect, assert } from "chai";
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from "../src";
import { importDB } from "./setup-tests/setup";

const serviceName = "person";
let testUser: any = null;
let specialCharactersUser: any = null;
describe(`Feathers Graph tests on ${serviceName} service `, () => {
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


  });

  it("Return related entities on person", async () => {
    try {
      testUser = await service.get('178509735', {});
      expect(testUser.related).is.not.undefined
    } catch (error) {
      console.error(error)
      assert.fail(error.message)
    }



  });


});
