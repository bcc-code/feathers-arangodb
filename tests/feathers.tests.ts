import feathers from '@feathersjs/feathers';
import { Application, Service } from 'feathersjs__feathers';
import { NotFound } from '@feathersjs/errors';
import ArangoDbService, { IArangoDbService, AUTH_TYPES } from '../src';
import { AutoDatabse } from '../src/auto-database';
import { expect } from 'chai';

const serviceName = 'people';
const idProp = 'id';

describe(`Feathers common tests, ${serviceName} service with \\${idProp}\\ id property `, () => {
  const promiseDatabase = 'TEST_PROMISE_DB';
  const testDatabase = 'TEST_DB';
  const testCollection = 'TEST_COL';
  const testUser = 'root';
  const testPass = '';
  let app: Application | any;
  let service: IArangoDbService<any>;
  let _ids: any = {};

  before(async () => {
    app = feathers();
    app.use(
      `/${serviceName}`,
      ArangoDbService({
        id: idProp,
        collection: testCollection,
        database: testDatabase,
        authType: AUTH_TYPES.BASIC_AUTH,
        username: testUser,
        password: testPass,
        events: ['testing']
      })
    );
    service = <IArangoDbService<any>>app.service(serviceName);
  });

  after(async () => {
    const database = new AutoDatabse();
    database.useBasicAuth(testUser, testPass);
    await database.dropDatabase(testDatabase);
    await database.dropDatabase(promiseDatabase);
  });

  beforeEach(async () => {
    const data: any = await service.create({
      name: 'Doug',
      age: 32
    });
    _ids.Doug = data[idProp];
  });

  afterEach(async () => {
    await service.remove(_ids.Doug).catch(() => {});
  });

  it('Service connects', async () => {
    await service.connect();
    expect(service.database).not.to.be.undefined
    expect(service.collection).not.to.be.undefined
  });

  it('Can connect to a specified database url', async () => {
    app.use(
      `/tasks`,
      ArangoDbService({
        id: idProp,
        collection: 'tasks',
        database: testDatabase,
        authType: AUTH_TYPES.BASIC_AUTH,
        username: testUser,
        password: testPass,
        events: ['testing'],
        dbConfig: {
          url: 'http://localhost:8529',
        }
      })
    );
    const otherUrl = <IArangoDbService<any>>app.service('tasks');
    await otherUrl.connect();
    expect(otherUrl.database).not.to.be.undefined
    expect(otherUrl.collection).not.to.be.undefined
  });

  it('Service setup check', async () => {
    await service.setup();
    expect(service.database).not.to.be.undefined;
    expect(service.collection).not.to.be.undefined;
  });

  it('works', async () => {
    const something = true;
    expect(service).not.to.be.undefined;
    expect(something).to.be.true;
  });

  it('sets `id` property on the service', () => {
    expect(service.id).to.eq(idProp);
  });

  it('Accepts a promise as a database reference', async () => {
    const autoDb = new AutoDatabse();
    autoDb.useBasicAuth(testUser, testPass);
    const promiseDb = autoDb.autoUseDatabase(promiseDatabase);
    const dbService = ArangoDbService({
      id: idProp,
      collection: testCollection,
      database: promiseDb
    });
    await dbService.connect();
    const info = await dbService.database.get();
    expect(dbService.database).not.to.be.undefined;
    expect(dbService.collection).not.to.be.undefined;
    expect(info.name).to.eq(promiseDatabase);
  });

  it('Accepts a promise as a collection reference', async () => {
    const autoDb = new AutoDatabse();
    autoDb.useBasicAuth(testUser, testPass);
    const db = await autoDb.autoUseDatabase(promiseDatabase);
    const collectionPromise = autoDb.autoCollection('PROMISE_COLLECTION');
    const dbService = ArangoDbService({
      id: idProp,
      collection: collectionPromise,
      database: db
    });
    await dbService.connect();
    const info = await dbService.collection.get();
    expect(dbService.database).not.to.be.undefined;
    expect(dbService.collection).not.to.be.undefined;
    expect(info.name).to.eq('PROMISE_COLLECTION');
  });

  it('Accepts string as database & collection', async () => {
    const dbService = ArangoDbService({
      id: idProp,
      collection: testCollection,
      database: testDatabase,
      authType: AUTH_TYPES.BASIC_AUTH,
      username: testUser,
      password: testPass
    });
    await dbService.connect();
    expect(dbService.database).not.to.be.undefined;
    expect(dbService.collection).not.to.be.undefined;
  });

  it('Accepts a database & collection as arguments', async () => {
    const database = new AutoDatabse();
    database.useBasicAuth(testUser, testPass);
    database.useDatabase(testDatabase);
    const collection = await database.collection(testCollection);
    const dbService = ArangoDbService({
      database,
      collection
    });
    expect(dbService.database).not.to.be.undefined;
    expect(dbService.collection).not.to.be.undefined;
  });

  it('sets `events` property from options', () => {
    expect(service.events.indexOf('testing')).not.to.eq(-1);
  });

  describe('extend', () => {
    it('extends and uses extended method', async () => {
      const now = new Date().getTime();
      // @ts-ignore  Extend added inside feathersJS via Uberproto
      const extended = service.extend({
        create: function create(data: any) {
          data.time = now;
          return this._super.apply(this, arguments);
        }
      });
      const createResult = await extended.create({ name: 'Dave' });
      const removeResult = await extended.remove(createResult[idProp]);
      expect(removeResult.time).to.eq(now);
    });
  });

  describe('get', () => {

    it('returns an instance that exists', async () => {
      const result = await service.get(_ids.Doug);
      expect(result[idProp].toString()).to.eq(_ids.Doug.toString());
      expect(result.name).to.eq('Doug');
      expect(result.age).to.eq(32);
    });

    it('supports $select', async () => {
      const result = await service.get(_ids.Doug, {
        query: { $select: ['name'] }
      });
      expect(result[idProp]).to.eq(_ids.Doug);
      expect(result.name).to.eq('Doug');
      expect(result.age).to.be.undefined;
    });

    it('returns NotFound error for non-existing id', () => {
      const badId = '568225fbfe21222432e836ff';
      service
        .get(badId)
        .then(() => {
          throw Error('Should NOT succeed!!!');
        })
        .catch(error => {
          expect(error instanceof NotFound).to.be.true;
          expect(error.message).to.eq(`No record found for id '${badId}'`);
        });
    });
  });

  describe('remove', () => {

    it('deletes an existing instance and returns the deleted instance', async () => {
      const result = await service.remove(_ids.Doug);
      expect(result['name']).to.eq('Doug');
    });

    it('deletes an existing instance supports $select', async () => {
      const result = await service.remove(_ids.Doug, {query: { $select: ['name']}});
      expect(result[idProp]).to.eq(_ids.Doug);
      expect(result['name']).to.eq('Doug');
      expect(result['age']).to.be.undefined;
    });

    it('deletes multiple instances', async () => {
      await service.create({name: 'Dave', age: 29, created: true});
      await service.create({name: 'David', age: 48, created: true});
      const result = await service.remove(null, {query: { created: true }});
      const names = result.map((person:any) => person.name);
      expect(names.indexOf('Dave')).to.be.greaterThan(-1);
      expect(names.indexOf('David')).to.be.greaterThan(-1);
    })
  });

  describe('find', () => {
    // Doug 32, Bob 25, ALice 19
    beforeEach(async () => {
      const bob = await service.create({ name: 'Bob', age: 25 });
      _ids.Bob = bob[idProp];
      const alice = await service.create({ name: 'Alice', age: 19 });
      _ids.Alice = alice[idProp];
    });

    afterEach(async () => {
      await service.remove(_ids.Bob);
      await service.remove(_ids.Alice);
    });

    it('returns all items', async () => {
      const result = <[any]> await service.find();
      expect(Array.isArray(result)).to.be.true;
      expect(result.length).to.eq(3);
    });

    it('filters results by a single parameter', async () => {
      const result = <[any]>await service.find({ query: { name: 'Alice' } });
      expect(Array.isArray(result)).to.be.true;
      expect(result.length).to.eq(1);
      expect(result[0].name).to.eq('Alice');
    });

    it('filters results by multiple parameters', async () => {
      // TODO This is a POOR test. Should be strengthened by having more than one age 19 or Alice
      const result = <[any]>await service.find({ query: { name: 'Alice', age: 19 } });
      expect(Array.isArray(result)).to.be.true;
      expect(result.length).to.eq(1);
      expect(result[0].name).to.eq('Alice');
    });

    describe('special filters', () => {

      it('can $sort', async () => {
        const params = {
          query: { $sort: { name: 1 } }
        };
        const result = <Array<any>>await service.find(params);
        expect(result.length).to.eq(3);
        expect(result[0].name).to.eq('Alice');
        expect(result[1].name).to.eq('Bob');
        expect(result[2].name).to.eq('Doug');
      });

      it('can $sort with strings', async () => {
        const params = {
          query: { $sort: { name: '1' } }
        };
        const result = <Array<any>>await service.find(params);
        expect(result.length).to.eq(3);
        expect(result[0].name).to.eq('Alice');
        expect(result[1].name).to.eq('Bob');
        expect(result[2].name).to.eq('Doug');
      });

      it('can $limit', async () => {
        const params = {
          query: { $limit: 2 }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(2);
      });

      it('can $limit 0', async () => {
        const params = {
          query: { $limit: 0 }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(0);
      });

      it('can $skip', async () => {
        const params = {
          query: { $sort: { name: 1 }, $skip: 1 }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(2);
        expect(result[0].name).to.eq('Bob');
        expect(result[1].name).to.eq('Doug');
      });

      it('can $select', async () => {
        const params = {
          query: { name: 'Alice', $select: ['name'] }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(1);
        expect(result[0].name).to.eq('Alice');
        expect(result[0].age).to.be.undefined;
      });

      it('can $or', async () => {
        const params = {
          query: { $or: [{ name: 'Alice' }, { name: 'Bob' }], $sort: { name: 1 } }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(2);
        expect(result[0].name).to.eq('Alice');
        expect(result[1].name).to.eq('Bob');
      });

      it('can $not', async () => {
        const params = {
          query: { age: { $not: 19 }, name: { $not: 'Doug' } }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(1);
        expect(result[0].name).to.eq('Bob');
      });

      it('can $in', async () => {
        const params = {
          query: { name: { $in: ['Alice', 'Bob'] }, $sort: { name: 1 } }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(2);
        expect(result[0].name).to.eq('Alice');
        expect(result[1].name).to.eq('Bob');
      });

      it('can $nin', async () => {
        const params = {
          query: { name: { $nin: ['Alice', 'Bob'] } }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(1);
        expect(result[0].name).to.eq('Doug');
      });

      it('can $lt', async () => {
        const params = {
          query: { age: { $lt: 30 }, $sort: { name: 1 } }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(2);
        expect(result[0].name).to.eq('Alice');
        expect(result[1].name).to.eq('Bob');
      });

      it('can $lte', async () => {
        const params = {
          query: { age: { $lte: 25 }, $sort: { name: 1 } }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(2);
        expect(result[0].name).to.eq('Alice');
        expect(result[1].name).to.eq('Bob');
      });

      it('can $gt', async () => {
        const params = {
          query: { age: { $gt: 30 }, $sort: { name: 1 } }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(1);
        expect(result[0].name).to.eq('Doug');
      });

      it('can $gte', async () => {
        const params = {
          query: { age: { $gte: 25 }, $sort: { name: 1 } }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(2);
        expect(result[0].name).to.eq('Bob');
        expect(result[1].name).to.eq('Doug');
      });

      it('can $ne', async () => {
        const params = {
          query: { age: { $ne: 25 }, $sort: { name: 1 } }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(2);
        expect(result[0].name).to.eq('Alice');
        expect(result[1].name).to.eq('Doug');
      });

      it('can $gt and $lt and $sort', async () => {
        const params = {
          query: { age: { $gt: 18, $lt: 30 }, $sort: { name: 1 } }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(2);
        expect(result[0].name).to.eq('Alice');
        expect(result[1].name).to.eq('Bob');
      });

      it('can handle nested $or queries and $sort', async () => {
        const params = {
          query: {
            $or: [{ name: 'Doug' }, {
              age: {
                $gte: 18,
                $lt: 25
              }
            }],
            $sort: { name: 1 }
          }
        };
        const result = <any[]>await service.find(params);
        expect(result.length).to.eq(2);
        expect(result[0].name).to.eq('Alice');
        expect(result[1].name).to.eq('Doug');
      });
    });

    describe('paginate', () => {
      beforeEach(async () => {
        service.paginate = { default: 1, max: 2 };
      });
      afterEach(async () => {
        service.paginate = {};
      });

      it('returns paginated object, paginates by default and shows total', async () => {
        const params = { query: { $sort: { name: -1 } } };
        const result = <any>await service.find(params);
        expect(result.total).to.eq(3);
        expect(result.limit).to.eq(1);
        expect(result.skip).to.eq(0);
        expect(result.data[0].name).to.eq('Doug');
      });

      it('paginates max and skips', async () => {
        const params = { query: { $skip: 1, $limit: 4, $sort: { name: -1 } } };
        const result = <any>await service.find(params);
        expect(result.total).to.eq(3);
        expect(result.limit).to.eq(2);
        expect(result.skip).to.eq(1);
        expect(result.data[0].name).to.eq('Bob');
        expect(result.data[1].name).to.eq('Alice');
      });

      it('$limit 0 with pagination', async () => {
        const params = { query: { $limit: 0 } };
        const result = <any>await service.find(params);
        expect(result.data.length).to.eq(0);
      });

      it('allows to override paginate in params', async () => {
        const params = { paginate: { default: 2, max: 1000 } };
        const result = <any>await service.find(params);
        expect(result.limit).to.eq(2);
        expect(result.skip).to.eq(0);
      });
    });
  });

  describe('update', () => {

    it('replaces an existing instance, does not modify original data', async () => {
      const newData:any = { name: 'Dougler'};
      newData[idProp] = _ids.Doug;
      const result = await service.update(_ids.Doug, newData);
      expect(result[idProp]).to.eq(_ids.Doug);
      expect(result['name']).to.eq('Dougler');
      expect(result['age']).to.be.undefined;
    });

    it('replaces an existing instance, supports $select', async () => {
      const newData:any = { name: 'Dougler', age: 10};
      newData[idProp] = _ids.Doug;
      const result = await service.update(_ids.Doug, newData, {query: { $select: ['name'] }});
      expect(result[idProp]).to.eq(_ids.Doug);
      expect(result['name']).to.eq('Dougler');
      expect(result['age']).to.be.undefined;
    });

    it('returns NotFound error for non-existing id', async () => {
      const badId = '568225fbfe21222432e836ff';
      const newData:any = { name: 'NotFound'};
      newData[idProp] = badId;
      await service.update(badId, newData).catch( error => {
        expect(error instanceof NotFound).to.be.true;
        expect(error.message).to.eq(`No record found for id '${badId}'`);
      })
    });
  });

  describe('patch', () => {
    it('updates an existing instance, does not modify original data', async () => {
      const newData:any = { name: 'PatchDoug'};
      newData[idProp] = _ids.Doug;
      const result = await service.patch(_ids.Doug, newData);
      expect(result[idProp]).to.eq(_ids.Doug);
      expect(result['name']).to.eq('PatchDoug');
      expect(result['age']).to.eq(32);
    });

    it('updates an existing instance, supports $select', async () => {
      const newData:any = { name: 'PatchDoug'};
      newData[idProp] = _ids.Doug;
      const result = await service.patch(_ids.Doug, newData, {query: { $select: ['name'] }});
      expect(result[idProp]).to.eq(_ids.Doug);
      expect(result['name']).to.eq('PatchDoug');
      expect(result['age']).to.be.undefined
    });

    it('patches multiple instances', async () => {
      const params = { query: { created: true } };
      await service.create({name: 'Dave', age: 29, created: true});
      await service.create({name: 'David', age: 3, created: true});
      const result = await service.patch(null, { age: 2 }, params);
      expect(result.length).to.eq(2);
      expect(result[0].age).to.eq(2);
      expect(result[1].age).to.eq(2);
      await service.remove(null, params);
    });

    it('patches multiple instances and returns the actually changed items', async () => {
      const params = { query: { age: { $lt: 10 } } };
      await service.create({name: 'Dave', age: 8, created: true});
      await service.create({name: 'David', age: 4, created: true});
      const result = await service.patch(null, { age: 2 }, params);
      expect(result.length).to.eq(2);
      expect(result[0].age).to.eq(2);
      expect(result[1].age).to.eq(2);
      await service.remove(null, params);
    });

    it('patches multiple, returns correct items', async () => {
      await service.create({name: 'Dave', age: 2, created: true});
      await service.create({name: 'David', age: 2, created: true});
      await service.create({name: 'Frank', age: 8, created: true});
      const result = await service.patch(null, { age: 8 }, { query: { age: 2 } });
      expect(result.length).to.eq(2);
      expect(result[0].age).to.eq(8);
      expect(result[1].age).to.eq(8);
      await service.remove(null, { query: { age: 8 } });
    });

    it('returns NotFound error for non-existing id', async () => {
      const badId = '568225fbfe21222432e836ff';
      const newData:any = { name: 'NotFound'};
      newData[idProp] = badId;
      await service.patch(badId, newData).catch( error => {
        expect(error instanceof NotFound).to.be.true;
        expect(error.message).to.eq(`No record found for id '${badId}'`);
      })
    });
  });

  describe('create', () => {
    it('creates a single new instance and returns the created instance', async () => {
      const originalData = { name: 'Bill', age: 40 };
      const result = await service.create(originalData);
      expect(result).not.to.be.undefined;
      expect(result).to.be.an('object').that.contains.keys(Object.keys(originalData));
      expect(result.name).to.eq('Bill')
      expect(result.age).to.eq(40)
      await service.remove(result[idProp]);
    });

    it('creates a single new instance, supports $select', async () => {
      const originalData = { name: 'William', age: 23 };
      const result = await service.create(originalData, {query: { $select: ['name'] }});
      expect(result).not.to.be.undefined;
      expect(result.name).to.eq('William');
      expect(result.age).to.be.undefined;
      await service.remove(result[idProp]);
    });

    it('creates multiple new instances', async () => {
      const originalData = [{
        name: 'Gerald',
        age: 18
      }, {
        name: 'Herald',
        age: 18
      }];
      const result = await service.create(originalData);
      expect(result).not.to.be.undefined;
      expect(Array.isArray(result)).to.be.true;
      expect(result[0].name).to.eq('Gerald');
      expect(result[1].name).to.eq('Herald');
      await service.remove(result[0][idProp]);
      await service.remove(result[1][idProp]);
    });
  });

  ///  HERE WE GO  !!!!!!!
  describe('Services don\'t call public methods internally', () => {
    let throwing:any;
    before(() => {
      // @ts-ignore  Extended isn't properly typed
      throwing = <any>service.extend({
        get store() {
          // @ts-ignore  Not sure where this comes from...
          return service.store;
        },

        find: function find() {
          throw new Error('find method called');
        },
        get: function get() {
          throw new Error('get method called');
        },
        create: function create() {
          throw new Error('create method called');
        },
        update: function update() {
          throw new Error('update method called');
        },
        patch: function patch() {
          throw new Error('patch method called');
        },
        remove: function remove() {
          throw new Error('remove method called');
        }
      });
    });

    it('find', async () => {
      await service.find.call(throwing);
    });

    it('get', async () => {
      await service.get.call(throwing, _ids.Doug);
    });

    it('create', async () => {
      const result = await service.create.call(throwing, { name: 'Bob', age: 25 });
      await service.remove(result[idProp]);
    });

    it('update', async () => {
      await service.update.call(throwing, _ids.Doug, { name: 'Dougler' });
    });

    it('patch', async () => {
      await service.patch.call(throwing, _ids.Doug, { name: 'PatchDoug' });
    });

    it('remove', async () => {
      await service.remove.call(throwing, _ids.Doug);
    });

  })

});

function getTestData(key: string | number): any {
  const data = {
    1: {
      name: 'Alice',
      age: 23,
      color: 'blue'
    }
  };
}