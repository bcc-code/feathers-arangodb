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

  function addSearch(query: any, docName: string = "doc",collection:string = "person"):AqlLiteral {

    const queryNumber = parseInt(query) || 0

    let searchQuery:AqlLiteral = aql.literal(`No query defined`)
    switch(collection) {
      case 'person':
        searchQuery = aql.literal(personSearch(docName,query))
        break;
      case 'person_role':
        searchQuery = aql.literal(
          `${docName}._from IN ( FOR r IN person_view SEARCH
          ${personSearch("r",query)} RETURN r._id )`);
        break;
      case 'country':
      searchQuery = aql.literal(`${generateFuzzyStatement(
            [{name:'nameEn', analyzer:'bcc_text',type:'string'},
            {name:'nameNo', analyzer:'bcc_text',type:'string'}],
            query,
            docName,
            )}
        `);
        break;
      case 'org':
        searchQuery = aql.literal(`${generateFuzzyStatement([{name:'name', analyzer:'bcc_text',type:'string'}],query,docName)}
        `);
        break;
      default:
        console.error('A search has been attempted on a collection where no search logic has been defined')
        break;
    }

    return searchQuery
  }

  const personSearch = (doc: string,query:string) => {
    const fuzzySearchFields: any[] = [
      { name: 'displayName',analyzer:'bcc_text',type:'string' },
      { name: 'email', analyzer:'identity',type:'string' },
      { name: 'personID',analyzer:'identity',type:'number' }
    ];
    return generateFuzzyStatement(fuzzySearchFields,query, doc)

  }

  function generateFuzzyStatement(fields:any, query:any,doc:string){
    if(!isNaN(parseInt(query))) query = parseInt(query)

    const queryType = typeof(query)
    let queryInStringOrNumber = queryType == 'string' ? `"${query}"` : query

    let fuzzyStatements = []

    for (const field of fields) {
      if(queryType == 'string' && field.type == 'string'){

        fuzzyStatements.push(`ANALYZER(${doc}.${field.name} IN TOKENS(${queryInStringOrNumber},'${field.analyzer}'),'${field.analyzer}')`)

      }else if(queryType == 'number' && field.type == 'number'){

          fuzzyStatements.push(`${doc}.${field.name} == ${queryInStringOrNumber}`)

       }
      }

      let result = fuzzyStatements.join(' OR ')
      result += ` SORT BM25(${doc}) desc `
    return result
  }

  export {
    addSearch
  }
