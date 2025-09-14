// Lambda function: getConfig.js
// This function fetches project/page config from DynamoDB

const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();

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
            ProjectKey: project,
            PageKey: page
        }
    };

    try {
        const result = await dynamo.get(params).promise();
        if (!result.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Config not found' })
            };
        }
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result.Item)
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
