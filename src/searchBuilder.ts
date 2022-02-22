import { BadRequest } from '@feathersjs/errors';

import { aql } from "arangojs";
import { AqlQuery } from "arangojs/aql";
import logger from "./logger";


type SearchQueryType = "number" | "exact" | 'fuzzy';
type SearchOrFilter = 'SEARCH' |'FILTER';
interface ModifiedQueryType {
  type:SearchQueryType;
  query:string | number;
  searchOrFilter:SearchOrFilter;
}

interface FuzzySearchField {
  name: string;
  analyzer: 'bcc_text' | 'identity';
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
      searchQuery = generateFuzzyStatement([{name:'name', analyzer:'bcc_text',type:'string'}],query,docName);
      break;
    default:
      throw new BadRequest('A search has been attempted on a collection where no search logic has been defined')
  }

  return searchQuery
}

const personSearch = (doc: string,query:string) => {
  const fuzzySearchFields: any[] = [
    { name: 'displayName',analyzer:'bcc_text',type:'string' },
    { name: 'email', analyzer:'identity',type:'string' },
    { name: 'personID',analyzer:'identity',type:'number' },
  ];
  return generateFuzzyStatement(fuzzySearchFields, query, doc);
}

const countrySearch = (doc: string,query:string) => {
  const fuzzySearchFields: any[] = [
    {name:'nameEn', analyzer:'bcc_text',type:'string'},
    {name:'nameNo', analyzer:'bcc_text',type:'string'},
    {name: 'countryID',analyzer:'identity',type:'number'},
  ];
  return generateFuzzyStatement(fuzzySearchFields, query, doc);
}

const orgSearch = (doc: string,query:string) => {
  const fuzzySearchFields: any[] = [
    {name:'name', analyzer:'bcc_text',type:'string'},
    {name: 'orgID',analyzer:'identity',type:'number'},
  ];
  return generateFuzzyStatement(fuzzySearchFields, query, doc);
}

function generateFuzzyStatement(fields:FuzzySearchField[], query:unknown ,doc:string): AqlQuery | undefined{
  const modifiedQuery:ModifiedQueryType = determineQueryType(query);
  const numberField = fields.find(f => f.type === 'number');
  const stringFields = fields.filter(f => f.type === 'string');

  const searchStatements:AqlQuery[] = [];
  switch (modifiedQuery.type) {
    case "number":
      if(!numberField) throw new BadRequest('Cannot search by number for this collection');
      searchStatements.push(aql`doc[${numberField.name}] == ${modifiedQuery.query}`);
      break;
    case "fuzzy":
      if(!stringFields.length) throw new BadRequest('Cannot search by string for this collection');
      for (const field of stringFields) {
        searchStatements.push(aql`ANALYZER(doc[${field.name}] IN TOKENS(${modifiedQuery.query},${field.analyzer}),${field.analyzer})`);
      }
      break;
    case "exact":
      if(!stringFields.length) throw new BadRequest('Cannot search by string for this collection');
      for (const field of stringFields) {
        searchStatements.push(aql`CONTAINS(LOWER(doc[${field.name}]),LOWER(${modifiedQuery.query}))`);
      }
      break;
    default:
      throw logger.error(`Unable to determine the type of search query between number,exact or fuzzy.`, {query: query});
  }

  if(!searchStatements.length) return undefined;

  const searchConditions = aql.join(searchStatements, ' OR ');
  const result = aql.join([
    aql.literal(modifiedQuery.searchOrFilter),
    searchConditions,
    aql`SORT BM25(doc) desc`,
  ])
  return result;
}

function determineQueryType(query:unknown):ModifiedQueryType {
  if(typeof query === 'number') query = query.toString();
  if(typeof query !== 'string') throw new BadRequest('Invalid query type');

  const queryInt = parseInt(query);
  if(!isNaN(queryInt)) return {type:"number",query:queryInt,searchOrFilter:"SEARCH"};

  if(hasQuotes(query)){
      const queryWithoutQoutes = query.slice(1, -1);
      return {type:"exact", query:queryWithoutQoutes, searchOrFilter:"FILTER"};
  }

  return {type:"fuzzy", query:query, searchOrFilter:"SEARCH"};
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
