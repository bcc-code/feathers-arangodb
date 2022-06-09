import { BadRequest } from '@feathersjs/errors';

import { aql } from "arangojs";
import { AqlQuery } from "arangojs/aql";

interface ModifiedQueryType {
  exact: boolean;
  value:string | number;
}

interface SearchField {
  name: string;
  isFuzzy: boolean;
  type: 'string' | 'number';
}

function addSearch(query: string, docName: string = "doc",collection:string = "person") {
  let searchQuery: AqlQuery | undefined = undefined;
  switch(collection) {
    case 'person':
      searchQuery = personSearch(docName,query);
      break;
    case 'country':
      searchQuery = countrySearch(docName,query);
      break;
    case 'org':
      searchQuery = orgSearch(docName,query);
      break;
    case 'application':
      searchQuery = generateFuzzyStatement([{name:'name', isFuzzy: true, type: 'string'}],query);
      break;
    default:
      throw new BadRequest('A search has been attempted on a collection where no search logic has been defined')
  }

  return searchQuery
}

const personSearch = (doc: string,query:string) => {
  const fuzzySearchFields: SearchField[] = [
    { name: 'fullName', isFuzzy: true, type: 'string'},
    { name: 'displayName', isFuzzy: true, type: 'string'},
    { name: 'email', isFuzzy: false, type: 'string'},
    { name: 'personID', isFuzzy: false, type: 'number'},
  ];
  return generateFuzzyStatement(fuzzySearchFields, query);
}

const countrySearch = (doc: string,query:string) => {
  const fuzzySearchFields: SearchField[] = [
    {name:'nameEn', isFuzzy: true, type: 'string'},
    {name:'nameNo', isFuzzy: true, type: 'string'},
    {name: 'countryID', isFuzzy: false, type: 'number'},
  ];
  return generateFuzzyStatement(fuzzySearchFields, query);
}

const orgSearch = (doc: string,query:string) => {
  const fuzzySearchFields: SearchField[] = [
    {name:'name', isFuzzy: true, type: 'string'},
    {name: 'orgID', isFuzzy: false, type: 'number'},
  ];
  return generateFuzzyStatement(fuzzySearchFields, query);
}

function generateFuzzyStatement(fields:SearchField[], query:any): AqlQuery | undefined{
  const modifiedQuery:ModifiedQueryType = determineQueryType(query);
  const searchStatements:AqlQuery[] = [];

  for(const field of fields){
    const statement = getSearchStatement(field, modifiedQuery);
    if (!statement) continue;
    searchStatements.push(
      statement
    )
  }

  if(!searchStatements.length) return undefined;

  const searchConditions = aql.join(searchStatements, ' OR ');
  const result = aql.join([
    aql.literal("SEARCH"),
    searchConditions,
    aql`SORT BM25(doc) desc`,
  ])
  return result;
}

function getSearchStatement(field: SearchField, query:ModifiedQueryType):AqlQuery | undefined{
  if (typeof query.value !== field.type) return undefined
  if (!field.isFuzzy) {
      return aql`doc[${field.name}] == ${query.value}`
  }
  if (query.exact){
    return aql`PHRASE(doc[${field.name}], ${query.value}, "space_delimited")`
  }
  
  return aql`NGRAM_MATCH(doc[${field.name}], ${query.value}, 0.6 , "fuzzy_search")`
}

function determineQueryType(value:string|number):ModifiedQueryType {
  if(!['string', 'number'].includes(typeof value)) throw new BadRequest('Invalid query type');

  let exact = false;
  if(typeof value === 'string' && hasQuotes(value)){
      value = value.slice(1, -1);
      exact = true
  }
  return {value, exact};
}

const hasQuotes = (string: string) => {
  const quoteCharacters = ["'", "\""];
  for(const quoteCharacter of quoteCharacters){
    if(string.startsWith(quoteCharacter) && string.endsWith(quoteCharacter))
      return true;
  }
  return false;
}


export {
    addSearch
}
