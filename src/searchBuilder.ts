import { BadRequest } from '@feathersjs/errors';

import { aql } from "arangojs";
import { AqlQuery } from "arangojs/aql";
import { IOptions } from '.';

interface ModifiedQueryType {
  exact: boolean;
  value:string | number;
}

export interface SearchField {
  name: string;
  isFuzzy: boolean;
  type: 'string' | 'number';
}

export function isQueryTypeCorrect(query: unknown): query is string|number {
  return ['string', 'number'].includes(typeof query)
}

export function generateFuzzyStatement(fields:SearchField[], query:string|number): AqlQuery | undefined{
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

  return searchConditions;
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

