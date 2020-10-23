import { AutoDatabse } from '../src/auto-database';
import { expect } from 'chai';
import { DocumentCollection } from 'arangojs/collection';

describe('AutoDatabase Class', () => {
  const db = new AutoDatabse({
    url: 'http://localhost:8529',
  });
  const testDatabase = 'TEST_AUTO_DB';
  const testCollection = 'TEST_AUTO_COL';
  const testUser = 'root';
  const testPass = 'root';

  before(async () => {
    db.useBasicAuth(testUser, testPass);
  });

  after(async () => {
    const database = new AutoDatabse();
    database.useBasicAuth(testUser, testPass);
    await database.dropDatabase(testDatabase);
  });


  it('Creates a database when needed', async () => {
    await db.autoUseDatabase(testDatabase);
    const info = await db.get();
    expect(info.name).to.eq(testDatabase);
  });

  it('Uses found database when needed', async () => {
    await db.autoUseDatabase(testDatabase);
    const info = await db.get();
    expect(info.name).to.eq(testDatabase);
  });

  it('Creates a collection when needed', async () => {
    const col = await db.autoCollection(testCollection) as DocumentCollection<any>;
    const info = await col.get();
    expect(info.name).to.eq(testCollection);
  });

  it('Uses found collection when needed', async () => {
    const col = await db.autoCollection(testCollection) as DocumentCollection<any>;
    const info = await col.get();
    expect(info.name).to.eq(testCollection);
  });

});
