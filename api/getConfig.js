// Lambda function: getConfig.js
// This function fetches project/page config from DynamoDB


const { DynamoDBClient, GetItemCommand, ScanCommand } = require("@aws-sdk/client-dynamodb");
const client = new DynamoDBClient();

// Environment variables: TABLE_NAME
exports.handler = async (event) => {
    // Get project and page from query params (API Gateway REST event)
    const project = event.queryStringParameters?.project;
    const page = event.queryStringParameters?.page;
    // If both project and page are provided, return single item
    if (project && page) {
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
    }

    // If only project is provided, return all pages for that project
    if (project && !page) {
        const params = {
            TableName: process.env.TABLE_NAME,
            FilterExpression: 'ProjectKey = :project',
            ExpressionAttributeValues: { ':project': { S: project } }
        };
        try {
            const command = new ScanCommand(params);
            const result = await client.send(command);
            const pages = (result.Items || []).map(item => {
                const page = {};
                for (const key in item) {
                    page[key] = Object.values(item[key])[0];
                }
                return page;
            });
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project, pages })
            };
        } catch (err) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: err.message })
            };
        }
    }

    // If neither project nor page is provided, return all projects grouped by ProjectKey
    // (admin panel use case)
    const params = { TableName: process.env.TABLE_NAME };
    try {
        const command = new ScanCommand(params);
        const result = await client.send(command);
        // Group by ProjectKey
        const grouped = {};
        (result.Items || []).forEach(item => {
            const page = {};
            let projectKey = '';
            for (const key in item) {
                const val = Object.values(item[key])[0];
                if (key === 'ProjectKey') projectKey = val;
                page[key] = val;
            }
            if (!grouped[projectKey]) grouped[projectKey] = [];
            grouped[projectKey].push(page);
        });
        // Convert to array of { projectKey, pages: [...] }
        const projects = Object.entries(grouped).map(([projectKey, pages]) => ({ projectKey, pages }));
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projects)
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
