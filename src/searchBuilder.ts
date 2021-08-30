  import _isNumber from "lodash/isNumber";
  import _filter from "lodash/filter";
  import _find from "lodash/find";

  import { aql } from "arangojs";
  import { AqlLiteral } from "arangojs/aql";
  import sanitizeFieldName from "./sanitizeQuery";

  function addSearch(query: any, docName: string = "doc",collection:string = "person"):AqlLiteral {

    const queryNumber = parseInt(query) || 0
    query =  sanitizeFieldName(query);

    let searchQuery:AqlLiteral = aql.literal(`No query defined`)
    switch(collection) {
      case 'person':
        searchQuery = aql.literal(personSearch(docName,query))
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
  type searchQueryType = "number" | "exact" | 'fuzzy'
  type searchOrFilter = 'SEARCH' |'FILTER'
  type modifiedQueryType = {type:searchQueryType,query:any,searchOrFilter:searchOrFilter}
  function generateFuzzyStatement(fields:any, query:any,doc:string){
    const modifiedQuery:modifiedQueryType = determineQueryType(query)
    let numberField:any;
    let stringFields:any;

    let searchStatements = []
    switch (modifiedQuery.type) {
      case "number":
        numberField = _find(fields,['type','number'])
        searchStatements.push(`${doc}.${numberField.name} == ${modifiedQuery.query}`)
        break;
      case "fuzzy":
        stringFields = _filter(fields,['type','string'])
        for (const field of stringFields) {
          searchStatements.push(`ANALYZER(${doc}.${field.name} IN TOKENS('${modifiedQuery.query}','${field.analyzer}'),'${field.analyzer}')`)
        }
        break;
      case "exact":
        stringFields = _filter(fields,['type','string'])
        for (const field of stringFields) {
          searchStatements.push(`CONTAINS(LOWER(${doc}.${field.name}),LOWER('${modifiedQuery.query}'))`)
        }
        break;
      default:
        throw console.error(`Unable to determine the type of search query, between number,exact or fuzzy, query: ${query}`);
        break;
    }

    let result = `${modifiedQuery.searchOrFilter} `
    result += searchStatements.join(' OR ')
    result += ` SORT BM25(${doc}) desc `
    return result
  }

  function determineQueryType(query:string):modifiedQueryType {

    if(!isNaN(parseInt(query))) return {type:"number",query:parseInt(query),searchOrFilter:"SEARCH"}

    if((query.startsWith("\"")
      ||query.startsWith("'"))
      &&
      (query.endsWith("\"")
      ||query.endsWith("'"))){
        query = query.replace("\"","")
        query = query.replace("\"","")
        query = query.replace("'","")
        query = query.replace("'","")
        return {type:"exact",query:query,searchOrFilter:"FILTER"}
    }

    return {type:"fuzzy",query:query,searchOrFilter:"SEARCH"}
  }

  export {
    addSearch
  }
