import { exec } from 'child_process';
import { promisify } from 'util';
import { assert } from 'chai';


// `exec()` is async and does not return a promise...
// This seems to be the accepted way to be able to wait for the execution
// to finish
const execPromise = promisify(exec);

const importDB = async (): Promise<void> => {

  const arangoDBConfig = {
    username:"root",
    password:"root",
    url:"tcp://127.0.0.1:8529/",
    database:"TEST"
  }

  // Decide whether to execute the windows script or the linux script
  let scriptExtension = (process.platform == 'win32') ? 'bat' : 'sh';
  let bat =  require.resolve(`./util_scripts/reset_test_db.${scriptExtension}`);
  bat = `${bat} ${arangoDBConfig.url} ${arangoDBConfig.username} ${arangoDBConfig.database}`
  // Execute the bat script
  await execPromise(bat)
  .catch((cause) => {
      console.error(cause);
      assert.fail('The import of test data failed with Error: ',cause);
    })
  .then( ({stdout}) => {
    console.log('Test data was importet in the fresh database: ',stdout);
  });
 }

export {
  importDB
}
