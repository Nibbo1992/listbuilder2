// app.js - All client-side logic for the Warhammer 40K Army Builder
(function() {
    "use strict";

    // --- Global Constants and State Variables ---
    // This is the base URL that points to your Netlify serverless function.
    // It is used to proxy requests to external XML files, which is necessary
    // to bypass Cross-Origin Resource Sharing (CORS) restrictions.
    // We are using the direct function path which is the most reliable way
    // to ensure the request is handled correctly.
    const BASE_URL = '/.netlify/functions/fetch-proxy';
    // This is the path to the main game catalogue file. This file contains
    // a list of all available factions and their corresponding file paths.
    const MASTER_CATALOGUE_PATH = 'Warhammer 40,000.gst';
    // This object will hold the parsed XML data for the main catalogue and
    // the currently selected faction's catalogue. We use it to avoid
    // re-fetching and re-parsing data unnecessarily.
    const CACHED_DATA = {};
    // This array will hold the units that the user has added to their army.
    let armyList = [];
    // This object will store the user's favorite units, using their unique
    // ID as the key. We will save this to localStorage for persistence.
    let favorites = {};

    // --- DOM Element References ---
    // Get references to all the important HTML elements we need to interact with.
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const factionSelect = document.getElementById('faction-select');
    const availableUnitsContainer = document.getElementById('available-units');
    const armyListContainer = document.getElementById('army-list');
    const pointsTotalElement = document.getElementById('points-total');
    const favoritesContainer = document.getElementById('favorites-container');
    const crusadeXpInput = document.getElementById('crusade-xp');
    const crusadeRpInput = document.getElementById('crusade-rp');
    const crusadeBattleHonorsInput = document.getElementById('crusade-battle-honors');
    const saveCrusadeBtn = document.getElementById('save-crusade');
    const crusadeStatusElement = document.getElementById('crusade-status');

    // --- Core Functions ---

    /**
     * Handles tab navigation. This function hides all content and shows
     * only the content for the clicked tab. It also updates the active
     * tab button's styling.
     * @param {string} tabId The ID of the tab to activate (e.g., 'battle-forge').
     */
    function showTab(tabId) {
        // First, remove the 'active' class from all tab buttons
        tabs.forEach(btn => btn.classList.remove('active-tab-btn'));
        // Then, add the 'active' class to the button that was clicked
        document.getElementById(`tab-${tabId}`).classList.add('active-tab-btn');

        // Hide all tab content containers
        tabContents.forEach(content => {
            content.classList.add('hidden');
            content.classList.remove('active-tab-content');
        });

        // Show the content container for the selected tab
        const activeContent = document.getElementById(`content-${tabId}`);
        activeContent.classList.remove('hidden');
        activeContent.classList.add('active-tab-content');

        // When the favorites tab is opened, we'll refresh the list
        if (tabId === 'favorites') {
            renderFavorites();
        }
    }

    /**
     * Fetches an XML file from a given URL using the Netlify proxy.
     * @param {string} fileName The name of the file to fetch (e.g., 'astra-militarum.cat').
     * @returns {Promise<Document>} A promise that resolves with the parsed XML Document.
     */
    async function fetchXML(fileName) {
        // We use a try-catch block to handle any network or parsing errors gracefully.
        try {
            // Construct the full URL to the GitHub file. This is the URL our proxy will fetch.
            const githubFileUrl = `https://raw.githubusercontent.com/BSData/wh40k-10e/main/${encodeURIComponent(fileName)}`;
            // Now, we build the URL for our own API endpoint, passing the GitHub URL as a query parameter.
            const url = `${BASE_URL}?url=${githubFileUrl}`;
            
            console.log(`Fetching XML from proxy with target: ${url}`);
            
            const response = await fetch(url);
            if (!response.ok) {
                // If the response is not OK (e.g., 404 Not Found), throw an error.
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the response as raw text.
            const xmlText = await response.text();
            
            // Parse the XML text into an XML Document object that we can navigate.
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

            // If the parser finds an error, throw an error to be caught by the try-catch block.
            if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                throw new Error('Failed to parse XML data.');
            }

            return xmlDoc;

        } catch (error) {
            console.error('Error fetching or parsing XML:', error);
            return null; // Return null on error so the calling function can handle it.
        }
    }

    /**
     * Parses the main game catalogue to populate the faction dropdown menu.
     */
    async function populateFactionSelect() {
        // Set the loading state for the dropdown.
        factionSelect.innerHTML = '<option value="" disabled selected>Loading Factions...</option>';
        
        // Fetch the master catalogue XML. We store it in our cache so we don't
        // need to fetch it again if the user comes back to the main tab.
        CACHED_DATA.masterCatalogue = await fetchXML(MASTER_CATALOGUE_PATH);

        if (CACHED_DATA.masterCatalogue) {
            // Get all 'catalogueLink' elements from the XML document.
            const factionLinks = CACHED_DATA.masterCatalogue.querySelectorAll('catalogueLink');
            
            // Clear the "Loading Factions" option.
            factionSelect.innerHTML = '<option value="" disabled selected>Select a Faction</option>';

            // Iterate through each faction link and add an option to the dropdown.
            factionLinks.forEach(link => {
                const name = link.getAttribute('name');
                const file = link.getAttribute('target');
                if (name && file) {
                    const option = document.createElement('option');
                    option.value = file;
                    option.textContent = name;
                    factionSelect.appendChild(option);
                }
            });
            console.log('Factions loaded successfully.');
        } else {
            factionSelect.innerHTML = '<p class="text-red-400 text-sm">Error loading factions. Check console for details.</p>';
        }
    }
    
    /**
     * Renders a single unit card in the available units container.
     * @param {Element} unit The XML element representing the unit.
     */
    function renderUnitCard(unit) {
        // Get unit name and points from the XML attributes.
        const unitName = unit.getAttribute('name');
        const unitPoints = unit.querySelector('cost[name="Pts"]') ? unit.querySelector('cost[name="Pts"]').getAttribute('value') : 'N/A';
        const unitId = unit.getAttribute('id'); // We'll use this to uniquely identify the unit.

        // Create the HTML for the unit card. We use a template literal for easy
        // string interpolation and a clean structure.
        const cardHtml = `
            <div class="unit-card" data-unit-id="${unitId}" data-unit-name="${unitName}" data-unit-points="${unitPoints}">
                <span class="unit-name">${unitName}</span>
                <div class="flex items-center">
                    <span class="unit-points">${unitPoints} pts</span>
                    <!-- Add to Army Button -->
                    <button class="add-to-army-btn ml-2 p-1 text-sm bg-gray-600 hover:bg-yellow-600 text-gray-100 rounded-md transition-colors" title="Add to Army List">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <!-- Favorite Button (Heart icon) -->
                    <button class="favorite-btn ${favorites[unitId] ? 'favorited' : ''}" title="${favorites[unitId] ? 'Unfavorite' : 'Favorite'} Unit">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
        // Insert the new card HTML at the end of the container's content.
        availableUnitsContainer.insertAdjacentHTML('beforeend', cardHtml);
    }
    
    /**
     * Handles adding a unit to the army list and updates the points total.
     * @param {string} unitId The unique ID of the unit to add.
     * @param {string} unitName The name of the unit.
     * @param {string} unitPoints The points value of the unit.
     */
    function addUnitToArmy(unitId, unitName, unitPoints) {
        // Create an object to represent the unit. This object will be used
        // to manage the army list data.
        const unit = { id: unitId, name: unitName, points: parseInt(unitPoints, 10) };
        armyList.push(unit);
        
        // Render the new unit card in the army list container.
        const armyListCardHtml = `
            <div class="added-unit-card" data-unit-id="${unitId}">
                <span class="unit-name">${unitName}</span>
                <div class="flex items-center">
                    <span class="unit-points">${unit.points} pts</span>
                    <!-- Remove Unit Button -->
                    <button class="remove-from-army-btn ml-2 p-1 text-sm bg-red-600 hover:bg-red-500 text-gray-100 rounded-md transition-colors" title="Remove from Army">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
        // Insert the new card HTML at the end of the army list container.
        armyListContainer.insertAdjacentHTML('beforeend', armyListCardHtml);

        // Update the points total.
        updatePointsTotal();
    }
    
    /**
     * Removes a unit from the army list and updates the points total.
     * @param {string} unitId The unique ID of the unit to remove.
     */
    function removeUnitFromArmy(unitId) {
        // Find the index of the first unit with the matching ID.
        const index = armyList.findIndex(unit => unit.id === unitId);
        if (index > -1) {
            // Remove the unit from the array.
            armyList.splice(index, 1);
            // Re-render the army list to reflect the change.
            renderArmyList();
            // Update the points total.
            updatePointsTotal();
        }
    }

    /**
     * Recalculates and updates the total points of the army.
     */
    function updatePointsTotal() {
        const totalPoints = armyList.reduce((sum, unit) => sum + unit.points, 0);
        pointsTotalElement.textContent = totalPoints;
    }

    /**
     * Renders the entire army list from the armyList array.
     */
    function renderArmyList() {
        // Clear the current list.
        armyListContainer.innerHTML = '';
        if (armyList.length === 0) {
            armyListContainer.innerHTML = '<p class="text-gray-400 text-sm">Add units to your army.</p>';
        } else {
            // Iterate through each unit and add a card to the list.
            armyList.forEach(unit => {
                const armyListCardHtml = `
                    <div class="added-unit-card" data-unit-id="${unit.id}">
                        <span class="unit-name">${unit.name}</span>
                        <div class="flex items-center">
                            <span class="unit-points">${unit.points} pts</span>
                            <button class="remove-from-army-btn ml-2 p-1 text-sm bg-red-600 hover:bg-red-500 text-gray-100 rounded-md transition-colors" title="Remove from Army">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
                armyListContainer.insertAdjacentHTML('beforeend', armyListCardHtml);
            });
        }
    }
    
    /**
     * Loads favorites from localStorage into the favorites object.
     */
    function loadFavorites() {
        const storedFavorites = localStorage.getItem('favorites');
        if (storedFavorites) {
            try {
                // Parse the JSON string back into a JavaScript object.
                favorites = JSON.parse(storedFavorites);
            } catch (e) {
                console.error("Could not parse favorites from localStorage.", e);
                favorites = {};
            }
        }
    }

    /**
     * Saves the current favorites object to localStorage.
     */
    function saveFavorites() {
        // Stringify the JavaScript object into a JSON string before saving.
        localStorage.setItem('favorites', JSON.stringify(favorites));
    }
    
    /**
     * Renders the list of favorite units.
     */
    function renderFavorites() {
        favoritesContainer.innerHTML = '';
        const favoriteUnits = Object.values(favorites);
        if (favoriteUnits.length === 0) {
            favoritesContainer.innerHTML = '<p class="text-gray-400 text-sm">You have no favorite units yet.</p>';
        } else {
            favoriteUnits.forEach(unit => {
                const favoriteCardHtml = `
                    <div class="unit-card" data-unit-id="${unit.id}">
                        <span class="unit-name">${unit.name}</span>
                        <div class="flex items-center">
                            <span class="unit-points">${unit.points} pts</span>
                            <button class="favorite-btn favorited ml-2 p-1" title="Unfavorite Unit">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
                favoritesContainer.insertAdjacentHTML('beforeend', favoriteCardHtml);
            });
        }
    }

    /**
     * Placeholder function for complex rule validation.
     * This is where you would implement logic for detachment rules, wargear options, etc.
     */
    function validateRules() {
        console.log("Placeholder: Validating detachment and wargear rules...");
        // This function would contain complex logic to check if the current army list
        // adheres to all the rules of the selected detachment, wargear options, etc.
        // For example, it would check if a unit has the correct wargear, if the army
        // is composed of units from a single faction, and so on.
    }
    
    // --- Event Listeners and Initialization ---

    // Listen for clicks on the tab buttons and show the corresponding tab.
    tabs.forEach(btn => {
        btn.addEventListener('click', (event) => {
            // Get the tab ID from the button's ID (e.g., 'tab-battle-forge' -> 'battle-forge').
            const tabId = event.target.id.replace('tab-', '');
            showTab(tabId);
        });
    });

    // Listen for a change on the faction dropdown. When a new faction is selected,
    // we fetch its catalogue and populate the available units list.
    factionSelect.addEventListener('change', async (event) => {
        const selectedFile = event.target.value;
        availableUnitsContainer.innerHTML = '<p class="text-gray-400 text-sm">Loading units...</p>';
        
        const factionCatalogue = await fetchXML(selectedFile);
        if (factionCatalogue) {
            CACHED_DATA.factionCatalogue = factionCatalogue; // Store in cache.
            availableUnitsContainer.innerHTML = '';
            // Find all 'selectionEntry' elements that represent units.
            const units = factionCatalogue.querySelectorAll('selectionEntry[type="unit"]');
            units.forEach(renderUnitCard);
            console.log(`Units for ${selectedFile} loaded.`);
        } else {
            availableUnitsContainer.innerHTML = '<p class="text-red-400 text-sm">Error loading units. Check console for details.</p>';
        }
    });

    // Use event delegation to handle clicks on dynamically added buttons.
    document.addEventListener('click', (event) => {
        // If the clicked element or its parent is a "add to army" button...
        const addToArmyBtn = event.target.closest('.add-to-army-btn');
        if (addToArmyBtn) {
            const unitCard = addToArmyBtn.closest('.unit-card');
            const unitId = unitCard.dataset.unitId;
            const unitName = unitCard.dataset.unitName;
            const unitPoints = unitCard.dataset.unitPoints;
            
            // Add the unit to the army list.
            addUnitToArmy(unitId, unitName, unitPoints);
            console.log(`Added ${unitName} to army.`);
            return; // Exit to prevent the click from bubbling up to other listeners.
        }

        // If the clicked element or its parent is a "remove from army" button...
        const removeFromArmyBtn = event.target.closest('.remove-from-army-btn');
        if (removeFromArmyBtn) {
            const unitCard = removeFromArmyBtn.closest('.added-unit-card');
            const unitId = unitCard.dataset.unitId;
            removeUnitFromArmy(unitId);
            console.log(`Removed unit with ID ${unitId} from army.`);
            return;
        }

        // If the clicked element or its parent is a "favorite" button...
        const favoriteBtn = event.target.closest('.favorite-btn');
        if (favoriteBtn) {
            // Get the parent unit card's data attributes.
            const unitCard = favoriteBtn.closest('.unit-card');
            const unitId = unitCard.dataset.unitId;
            const unitName = unitCard.dataset.unitName;
            const unitPoints = unitCard.dataset.unitPoints;
            
            // Toggle the favorited state.
            if (favorites[unitId]) {
                delete favorites[unitId];
                favoriteBtn.classList.remove('favorited');
                favoriteBtn.title = 'Unfavorite Unit';
                console.log(`Removed ${unitName} from favorites.`);
            } else {
                favorites[unitId] = { id: unitId, name: unitName, points: parseInt(unitPoints, 10) };
                favoriteBtn.classList.add('favorited');
                favoriteBtn.title = 'Unfavorite Unit';
                console.log(`Added ${unitName} to favorites.`);
            }
            saveFavorites(); // Save the new favorites list to localStorage.
            return;
        }
    });
    
    // Save Crusade Tracker data to localStorage when the button is clicked.
    saveCrusadeBtn.addEventListener('click', () => {
        const crusadeData = {
            battleHonors: crusadeBattleHonorsInput.value,
            xp: crusadeXpInput.value,
            rp: crusadeRpInput.value,
        };
        localStorage.setItem('crusadeData', JSON.stringify(crusadeData));
        crusadeStatusElement.textContent = 'Crusade progress saved!';
        setTimeout(() => crusadeStatusElement.textContent = '', 3000); // Clear message after 3 seconds.
    });

    // Load Crusade Tracker data from localStorage on app load.
    function loadCrusadeData() {
        const storedData = localStorage.getItem('crusadeData');
        if (storedData) {
            const crusadeData = JSON.parse(storedData);
            crusadeBattleHonorsInput.value = crusadeData.battleHonors || '';
            crusadeXpInput.value = crusadeData.xp || '';
            crusadeRpInput.value = crusadeData.rp || '';
        }
    }

    // Initial setup when the page loads.
    document.addEventListener('DOMContentLoaded', () => {
        // Start the process by populating the faction dropdown.
        populateFactionSelect();
        // Load any saved favorite units.
        loadFavorites();
        // Load any saved Crusade Tracker data.
        loadCrusadeData();
        // Ensure the correct tab is shown on load (Battle Forge).
        showTab('battle-forge');
    });

})();
