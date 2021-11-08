#! /bin/bash

# Exit on error. Append "|| true" if you expect an error.
set -o errexit
# Exit on error inside any functions or subshells.
set -o errtrace
# Do not allow use of undefined vars. Use ${VAR:-} to use an undefined VAR
set -o nounset
# Catch the error in case mysqldump fails (but gzip succeeds) in `mysqldump |gzip`
set -o pipefail
# Turn on traces, useful while debugging but commented out by default
# set -o xtrace

# Location of the script (not PWD)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

URL="$1"
USERNAME="$2"
PASSWORD="$3"
DATABASE="$4"

arangorestore \
  --server.database "$DATABASE" \
  --server.username "$USERNAME" \
  --server.password "$PASSWORD" \
  --server.authentication true \
  --server.endpoint "$URL" \
  --include-system-collections true \
  --input-directory "$DIR/../test_data" \
  --create-database true
