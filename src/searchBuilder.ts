  import _isNumber from "lodash/isNumber";
  import _isBoolean from "lodash/isBoolean";
  import _isObject from "lodash/isObject";
  import _isString from "lodash/isString";
  import _omit from "lodash/omit";
  import _get from "lodash/get";
  import _set from "lodash/set";
  import _isEmpty from "lodash/isEmpty";
  import { Params } from "@feathersjs/feathers";
  import { aql } from "arangojs";
  import { AqlQuery, AqlValue } from "arangojs/aql";
  import { AqlLiteral } from "arangojs/aql";

  function addSearch(query: any, docName: string = "doc",collection:string = "person",tokensVariableName:string):AqlLiteral {

    const queryNumber = parseInt(query) || 0

    console.log("the new function works")
    let searchQuery:AqlLiteral = aql.literal(`No query defined`)
    switch(collection) {
      case 'person':
        searchQuery = aql.literal(personSearch(docName,query,tokensVariableName))
        break;
      case 'person_role':
        searchQuery = aql.literal(
          `${docName}._from IN ( FOR r IN person_view SEARCH
          ${personSearch(docName,query,tokensVariableName)} RETURN r._id )`);
        break;
      case 'country':
      searchQuery = aql.literal(`${generateFuzzyStatement([{name:'nameEn',threshold:2},{name:'nameNo',threshold:2}],query,docName,tokensVariableName)}
        `);
        break;
      case 'org':
        searchQuery = aql.literal(`${generateFuzzyStatement([{name:'name',threshold:2}],query,docName,tokensVariableName)}
        OR ${docName}.churchID == ${queryNumber}
        `);
        break;
      default:
        console.error('A search has been attempted on a collection where no search logic has been defined')
        break;
    }

    return searchQuery
  }

  const personSearch = (doc: string,query:string,tokensVariableName:string) => {
    const fuzzySearchFields: any[] = [
      { name: 'firstName', threshold: 2 },
      { name: 'lastName', threshold: 2 },
      { name: 'displayName', threshold: 3 },
      { name: 'email', threshold: 2 }
    ];
    return generateFuzzyStatement(fuzzySearchFields,query, doc,tokensVariableName)

  }

  function generateFuzzyStatement(fields:any, query:string,doc:string,tokensVariableName:string){

    let fuzzyStatements = []

    for (const field of fields) {
        const numberOfWords = query.split(" ").length;
		for (let index = 0; index < numberOfWords; index++) {
            fuzzyStatements.push(`ANALYZER(LEVENSHTEIN_MATCH(${doc}.${field.name}, ${tokensVariableName}[${index}], ${field.threshold}), "person")`)
            fuzzyStatements.push(`ANALYZER(STARTS_WITH(${doc}.${field.name}, ${tokensVariableName}[${index}]), "person")`)
		}
      }

      let result = fuzzyStatements.join(' OR ')
      result += 'SORT BM25(doc) desc'
      result += 'limit 40'
    return result
  }

  export {
    addSearch
  }
