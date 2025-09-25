// app.js - Client-side script to fetch and display raw file data.
(function() {
    "use strict";

    // --- Global Constants ---
    // The base URL for fetching files from your Netlify proxy.
    const BASE_URL = '/api/proxy-to-github/';
    // The specific file path to fetch. This is the main Warhammer 40K catalogue file.
    const MASTER_CATALOGUE_PATH = 'Warhammer%2040,000.gst';

    // --- Main Fetch Function ---
    /**
     * Fetches a file from the defined BASE_URL and displays its raw content.
     * @param {string} fileName The name of the file to fetch.
     */
    async function fetchAndDisplayRawData(fileName) {
        // Get the DOM element where we will display the raw text.
        const rawOutputElement = document.getElementById('raw-file-content');
        
        console.log(`Attempting to fetch raw data for: ${fileName}`);
        const url = BASE_URL + fileName;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                // Throw an error if the HTTP request was not successful.
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Get the raw text from the response.
            const fileString = await response.text();
            
            console.log(`Raw data for ${fileName} fetched successfully.`);
            
            // Update the content of the <pre> tag with the raw text.
            rawOutputElement.textContent = fileString;
            
        } catch (error) {
            console.error('Error fetching or displaying raw data:', error);
            // Display an error message if something went wrong.
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
