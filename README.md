# feathers-arangodb
A [Feathers](https://feathersjs.com) database adapter for [ArangoDB](https://www.arango.org/) using [official NodeJS driver for ArangoDB](https://github.com/arangodb/arangojs).

```bash
$ npm install --save arangojs @bcc-code/feathers-arangodb
```

> **Important:** `@bcc-code/feathers-arangodb` implements the [Feathers Common database adapter API](https://docs.feathersjs.com/api/databases/common.html) and [querying syntax](https://docs.feathersjs.com/api/databases/querying.html).

> This adapter also requires a [running ArangoDB](https://docs.arangodb.com/3.3/Manual/GettingStarted/) database server.

---

#### Test the adapter
```bash
$ npm run test
```

#### Database Options

**id** _(optional)_ : String : Translated ID key value in payloads. Actual storage in database is saved in the `_key` key/value within ArangoDB. Defaults to `_key`

**expandData** _(optional)_ : Boolean : Adapter filters out `_rev` and `_id` from ArangoDB. Setting expandData to true will include these in the payload results. Defaults to `false`

**collection** _(required)_ : Collection | String : Either a string name of a collection, which will be created if it doesn't exist in database, or a reference to an existing arangoDB collection object.

**view** _(optional)_ : View | String : Either a string name of a view, which will be created if it doesn't exist in database, or a reference to an existing arangoDB view object.

**database** _(required)_ : Database | String : Either a string name of a database, which will be created if it doesn't exist on the ArangoDB server, or a reference to an existing ArangoDB database object.

**graph** _(optional)_ : Graph | { properties, opts } : Graph options to create a new graph. `name` is required in the properties. [See Documentation](https://docs.arangodb.com/devel/HTTP/Gharial/Management.html#create-a-graph)

**authType** _(optional)_ : String : String value of either `BASIC_AUTH` or `BEARER_AUTH`. Used to define the type of auth to ArangoDB ([see documentation](https://docs.arangodb.com/devel/Drivers/JS/Reference/Database/#databaseusebasicauth)). Defaults to `BASIC_AUTH`

**username** _(optional)_ : String : Used for auth, plaintext username

**password** _(optional)_ : String : Used for auth, plaintext password

**token** _(optional)_ : String : If token is supplied, auth uses token instead of username/password.

**dbConfig** _(optional)_ : ArangoDbConfig : ArangoDB Config file for a new database. [See Documentation](https://docs.arangodb.com/devel/Drivers/JS/Reference/Database/#new-database)

**events** _(optional)_ : Array : FeathersJS Events - [See Documentation](https://docs.feathersjs.com/api/events.html)

**paginate** _(optional)_ : FeathersJS Paginate : FeathersJS Paginate - [See Documentation](https://docs.feathersjs.com/api/databases/common.html#pagination)

Copyright (c) 2018

Licensed under the [MIT license](LICENSE).
