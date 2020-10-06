:: This script goes to the production instance of project and pulls down the newest data from the "MEMBERS_TEST_TEMPLATE"
:: Every time the test data is improved this script should be run
:: This script is ment to be run manually
:: The username password is exposed here, but since this user only have read access to the test data this is exceptable
@echo off
echo We are in the .bat script.

:: Set the current directory to where the test data is located
pushd "..\test_data"
echo.Im at this directory: %CD%

:: Delete all the current files in the directory
del /q %CD%\*

arangodump  ^
  --server.database "MEMBERS_TEST_TEMPLATE" ^
  --server.username "import_test_data" ^
  --server.password "" ^
  --server.authentication "true" ^
  --server.endpoint "http+ssl://1527024caabf.arangodb.cloud:8529/" ^
  --output-directory %CD%

pause

