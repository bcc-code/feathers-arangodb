import { assert } from "chai";
import { QueryBuilder } from "../src/queryBuilder";


describe(`Aql injection prevention tests `, () => {

  it("AQL injection on find with filter is parameterized and treated as any other query", async () => {
    const query = {"MALICIOUS_PAYLOAD":"!"}
    const queryBuilder = new QueryBuilder( { query })
    assert.notInclude(queryBuilder.filter.query, "MALICIOUS_PAYLOAD")
  });

  it("Aql injection on search is detected and not let through", async () => {
    const query = {$search:"MALICIOUS_PAYLOAD"};
    
    const queryBuilder = new QueryBuilder( { query }, "doc", "doc", [{name: "name", isFuzzy: true, type: "string"}])
    assert.notInclude(queryBuilder.search.query, "MALICIOUS_PAYLOAD")
  })
});
