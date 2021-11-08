  import _isNumber from "lodash/isNumber";
  import _filter from "lodash/filter";
  import _find from "lodash/find";

  import { aql } from "arangojs";
  import { AqlLiteral, AqlQuery } from "arangojs/aql";

  function addSearch(query: string,collection:string = "person"):AqlQuery | undefined{

    let searchQuery: AqlQuery | undefined = undefined;
    switch(collection) {
      case 'person':
        searchQuery = personSearch(query)
        break;
      case 'country':
      searchQuery = generateFuzzyStatement(
            [{name:'nameEn', analyzer:'bcc_text',type:'string'},
            {name:'nameNo', analyzer:'bcc_text',type:'string'}],
            query,
            )
        break;
      case 'org':
      case 'application':
        searchQuery = generateFuzzyStatement([{name:'name', analyzer:'bcc_text',type:'string'}],query);
        break;
      default:
        console.error('A search has been attempted on a collection where no search logic has been defined')
        break;
    }

    return searchQuery
  }

  const personSearch = (query:string): AqlQuery => {
    const fuzzySearchFields: any[] = [
      { name: 'displayName',analyzer:'bcc_text',type:'string' },
      { name: 'email', analyzer:'identity',type:'string' },
      { name: 'personID',analyzer:'identity',type:'number' }
    ];
    return generateFuzzyStatement(fuzzySearchFields, query)

  }
  type searchQueryType = "number" | "exact" | 'fuzzy'
  type searchOrFilter = 'SEARCH' |'FILTER'
  type modifiedQueryType = {type:searchQueryType,query:any,searchOrFilter:searchOrFilter}
  function generateFuzzyStatement(fields:any, query:string): AqlQuery{
    const modifiedQuery:modifiedQueryType = determineQueryType(query)
    let numberField:any;
    let stringFields:any;

    let searchStatements:AqlQuery[] = []
    switch (modifiedQuery.type) {
      case "number":
        numberField = _find(fields,['type','number'])
        searchStatements.push(aql`doc[${numberField.name}] == ${modifiedQuery.query}`)
        break;
      case "fuzzy":
        stringFields = _filter(fields,['type','string'])
        for (const field of stringFields) {
          searchStatements.push(aql`ANALYZER(doc[${field.name}] IN TOKENS(${modifiedQuery.query},${field.analyzer}),${field.analyzer})`)
        }
        break;
      case "exact":
        stringFields = _filter(fields,['type','string'])
        for (const field of stringFields) {
          searchStatements.push(aql`CONTAINS(LOWER(doc[${field.name}]),LOWER(${modifiedQuery.query}))`)
        }
        break;
      default:
        throw console.error(`Unable to determine the type of search query, between number,exact or fuzzy, query: ${query}`);
    }
    const searchConditions = aql.join(searchStatements, ' OR ')
    let result = aql.join([
      aql.literal(modifiedQuery.searchOrFilter),
      searchConditions,
      aql`SORT BM25(doc) desc`
    ])
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
