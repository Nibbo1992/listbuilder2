// app.js - Client-side script to fetch and display raw file data.
(function() {
    "use strict";

    // --- Global Constants ---
    // This is the new base URL that points directly to your Netlify serverless function.
    // We are no longer relying on the Netlify redirect rule in _redirects.txt for this,
    // as the function itself will handle the proxying.
    const BASE_URL = '/.netlify/functions/fetch-proxy';

    // The specific file path on the GitHub repository to fetch.
    // The spaces are no longer URL-encoded here because the `encodeURIComponent`
    // function will handle that for us later when we construct the full URL.
    const MASTER_CATALOGUE_PATH = 'Warhammer 40,000.gst';

    // --- Main Fetch Function ---
    /**
     * Fetches a file from the defined BASE_URL and displays its raw content.
     * @param {string} fileName The name of the file to fetch.
     */
    async function fetchAndDisplayRawData(fileName) {
        // Get the DOM element where we will display the raw text.
        const rawOutputElement = document.getElementById('raw-file-content');
        
        console.log(`Attempting to fetch raw data for: ${fileName}`);

        // Construct the URL to our serverless function, which expects a 'url' query parameter.
        // `encodeURIComponent` is used to safely encode the fileName.
        // This is crucial for handling special characters like spaces in the filename.
        // The URL now looks something like this:
        // /.netlify/functions/fetch-proxy?url=https://raw.githubusercontent.com/BSData/wh40k-10e/main/Warhammer%2040%2C000.gst
        const githubFileUrl = `https://raw.githubusercontent.com/BSData/wh40k-10e/main/${encodeURIComponent(fileName)}`;
        const url = `${BASE_URL}?url=${githubFileUrl}`;

        try {
            // Make the network request to our serverless function URL.
            const response = await fetch(url);
            if (!response.ok) {
                // Throw an error if the HTTP request was not successful.
                // This will catch status codes like 404, 500, etc.
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Get the raw text from the response.
            // This is the text content of the file that the serverless function fetched for us.
            const fileString = await response.text();
            
            console.log(`Raw data for ${fileName} fetched successfully.`);
            
            // Update the content of the <pre> tag with the raw text.
            rawOutputElement.textContent = fileString;
            
        } catch (error) {
            console.error('Error fetching or displaying raw data:', error);
            // Display an error message if something went wrong, either with the fetch or parsing.
            rawOutputElement.textContent = `Error: Failed to fetch data. See console for details.\n\n${error.message}`;
        }
    }

    // --- Initialization ---
    // Ensure the script runs only after the HTML document is fully loaded.
    document.addEventListener('DOMContentLoaded', () => {
        // Start the process by fetching the master catalogue file.
        fetchAndDisplayRawData(MASTER_CATALOGUE_PATH);
    });
})();
