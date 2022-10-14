import { Database } from "arangojs";

export default async function (systemDb: Database, databaseName: string, collectionName: string, viewName: string) {
    const db = await systemDb.createDatabase(databaseName);
    await db.createCollection(collectionName);
    await db.createAnalyzer('fuzzy_search', {
        type: 'pipeline',
        properties: {
            pipeline: [
                {type: 'norm', properties: {locale: 'en.utf-8', case: 'lower', accent: false}},
                {
                    type: 'ngram',
                    properties: {
                        max: 2,
                        min: 2,
                        preserveOriginal: false,
                    },
                },
            ],
        },
        features: ['frequency', 'norm', 'position'],
    });
    await db.createAnalyzer('space_delimited', {
        type: 'delimiter',
        properties: {
            delimiter: ' ',
        },
        features: ['frequency', 'norm', 'position'],
    });
    await db.createView(viewName, {
        links: {
            [collectionName]: {
                includeAllFields: true,
                fields: {
                    name: {
                        analyzers: ['fuzzy_search', 'space_delimited'],
                    },
                },
            },
        },
    })

    return db
}
