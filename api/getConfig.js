// Lambda function: getConfig.js
// This function fetches project/page config from DynamoDB


const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const client = new DynamoDBClient();

// Environment variables: TABLE_NAME
exports.handler = async (event) => {
    // Get project and page from query params (API Gateway REST event)
    const project = event.queryStringParameters?.project;
    const page = event.queryStringParameters?.page;
    if (!project || !page) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing project or page parameter' })
        };
    }


    const params = {
        TableName: process.env.TABLE_NAME,
        Key: {
            ProjectKey: { S: project },
            PageKey: { S: page }
        }
    };

    try {
        const command = new GetItemCommand(params);
        const result = await client.send(command);
        if (!result.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Config not found' })
            };
        }
        // Convert DynamoDB item to plain JS object
        const unmarshalled = {};
        for (const key in result.Item) {
            unmarshalled[key] = Object.values(result.Item[key])[0];
        }
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(unmarshalled)
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
