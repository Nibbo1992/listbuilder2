// netlify/functions/fetch-proxy.js
// This serverless function acts as a proxy to fetch data from an external URL,
// bypassing CORS restrictions on the client side.

const fetch = require('node-fetch');

exports.handler = async (event) => {
    // Get the URL from the query string of the request.
    const githubUrl = event.queryStringParameters.url;

    // Check if the URL parameter exists and is a valid string.
    if (!githubUrl) {
        return {
            statusCode: 400,
            body: 'Error: Missing "url" query parameter.'
        };
    }

    try {
        // Fetch the data from the GitHub URL.
        const response = await fetch(githubUrl);
        
        // If the fetch was not successful, return an appropriate status code.
        if (!response.ok) {
            return {
                statusCode: response.status,
                body: `Error fetching data: ${response.statusText}`
            };
        }

        // Get the raw text of the response.
        const data = await response.text();

        // Return the data to the client with a successful status code.
        return {
            statusCode: 200,
            body: data,
        };

    } catch (error) {
        // Catch any network or other errors and return a 500 status.
        return {
            statusCode: 500,
            body: `Internal Server Error: ${error.message}`
        };
    }
};
