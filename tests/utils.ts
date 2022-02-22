import { assert } from "chai";

export const checkError = (error: unknown, expectedMessage: string) => {
    if(!(error instanceof Error)) throw Error('Invalid Error type');
    assert.equal(error.message, expectedMessage);
}