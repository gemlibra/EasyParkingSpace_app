// =========================================================================
// 1. GLOBAL APP STATE & LIVE DATA CACHE
// =========================================================================
let currentMode = 'paid'; 
let currentIndex = 0; // Tracks which record index the user is currently viewing

/**
 * All mock data has been purged. The arrays start completely empty.
 * The application will automatically populate these with live data from the 
 * NYC municipal servers during initialization and subsequent searches.
 */
const appData = {
    paid: [],
    street: []
};

// =========================================================================
// 2. NYC OPEN DATA API INTERACTION LAYER
// =========================================================================

/**
 * Fetches real-time commercial and municipal garage records from DCWP via Socrata SODA API.
 * Updated to be 100% case-insensitive using SoQL upper() to prevent 0-record return bugs.
 */
async function fetchLiveGarageData(boroughName) {
    const ENDPOINT = "https://data.cityofnewyork.us/resource/a7m8-iids.json";
    const boroughUpper = boroughName.trim().toUpperCase();
    
    const params = new URLSearchParams({
        "$where": `upper(address_borough) = '${boroughUpper}' AND latitude IS NOT NULL AND longitude IS NOT NULL`, 
        "$limit": "50" 
    });

    try {
        const response = await fetch(`${ENDPOINT}?${params}`);
        if (!response.ok) throw new Error(`API Error Status: ${response.status}`);
        
        const rawJsonArray = await response.json();
        
        return rawJsonArray.map((item, index) => {
            const countMatch = item.detail ? item.detail.match(/\d+/) : null;
            const spacesText = countMatch ? `${countMatch[0]} Total Spaces Allocated` : "Capacity Regulated";

            return {
                id: 1000 + index, 
                title: item.business_name || "NYC Licensed Parking Facility",
                hours: `${spacesText} | Loc: ${item.address_building_number || ''} ${item.address_street_name || ''}`.trim(),
                asp: null 
            };
        });
    } catch (err) {
        console.error("⚠️ Garage API retrieval failed:", err);
        return []; 
    }
}

/**
 * Fetches real-time curbside rules from the NYC DOT Signs dataset via Socrata SODA API.
 */
async function fetchLiveStreetData(boroughName) {
    const ENDPOINT = "https://data.cityofnewyork.us/resource/nfid-uabd.json";
    const formattedBorough = boroughName.trim().charAt(0).toUpperCase() + boroughName.trim().slice(1).toLowerCase();

    const params = new URLSearchParams({
        "borough": formattedBorough,
        "$where": "sign_description IS NOT NULL AND on_street IS NOT NULL",
        "$limit": "50"
    });

    try {
        const response = await fetch(`${ENDPOINT}?${params}`);
        if (!response.ok) throw new Error(`API Error Status: ${response.status}`);

        const rawJsonArray = await response.json();

        return rawJsonArray.map((item, index) => {
            return {
                id: 2000 + index,
                title: `${item.on_street} (From: ${item.from_street || 'Block start'} To: ${item.to_street || 'Block end'})`,
                hours: "Curb Regulations Map Segment",
                asp: item.sign_description 
            };
        });
    } catch (err) {
        console.error("⚠️ Street API retrieval failed:", err);
        return [];
    }
}

// =========================================================================
// 3. BOOTLOADER (RUNS IMMEDIATELY ON PAGE LOAD)
// =========================================================================
async function initApp() {
    console.log("🚀 EasyParking: Live Engine Integration Engine Ready. System operational.");
    
    setupEventListeners();
    setupLocalSearchSimulation();

    console.log("📡 Pre-loading live data for Manhattan...");
    const initialGarages = await fetchLiveGarageData('Manhattan');
    const initialStreets = await fetchLiveStreetData('Manhattan');

    if (initialGarages.length > 0) appData.paid = initialGarages;
    if (initialStreets.length > 0) appData.street = initialStreets;
    
    console.log("✅ Initialization complete. Live records cached.");
}

// =========================================================================
// 4. DETAILS PANEL CONTROLLER (WITH DYNAMIC PAGINATION ENGINE)
// =========================================================================
function displayDetails(location) {
    if (!location) {
        console.warn("⚠️ Display blocked: location object is missing or empty.");
        return;
    }

    const panel = document.getElementById("details-panel");
    const title = document.getElementById("location-title");
    const type = document.getElementById("parking-type");
    const hours = document.getElementById("parking-hours");
    const aspContainer = document.getElementById("asp-warning-container");
    const aspDetails = document.getElementById("asp-details");

    if (!panel) { console.error("❌ HTML Error: Cannot find id='details-panel'"); return; }
    
    if (title) title.innerText = location.title;
    if (type) type.innerText = currentMode === 'paid' ? "Indoor Paid Garage" : "Street Parking Space";
    if (hours) hours.innerText = location.hours;

    if (location.asp && aspDetails && aspContainer) {
        aspDetails.innerText = location.asp;
        aspContainer.classList.remove("hidden");
    } else if (aspContainer) {
        aspContainer.classList.add("hidden");
    }

    // DYNAMIC PANEL NAVIGATION CONTROLLERS
    let navContainer = document.getElementById("panel-nav-controls");
    if (!navContainer) {
        navContainer = document.createElement("div");
        navContainer.id = "panel-nav-controls";
        
        navContainer.style.display = "flex";
        navContainer.style.justify = "space-between";
        navContainer.style.alignItems = "center";
        navContainer.style.marginTop = "20px";
        navContainer.style.paddingTop = "15px";
        navContainer.style.borderTop = "1fr solid #f2f2f7";
        
        const contentBox = document.querySelector(".panel-content");
        if (contentBox) contentBox.appendChild(navContainer);
    }
    
    const totalRecords = appData[currentMode].length;
    
    if (totalRecords > 1) {
        navContainer.innerHTML = `
            <button id="prev-record-btn" style="background:rgba(255,255,255,0.2); border:none; padding:8px 14px; border-radius:8px; font-weight:bold; cursor:pointer;" ${currentIndex === 0 ? 'disabled style="opacity:0.4; cursor:default;"' : ''}>&larr; Prev</button>
            <span style="font-size:12px; color:#FFFFFF; font-weight:600;">Record ${currentIndex + 1} of ${totalRecords}</span>
            <button id="next-record-btn" style="background:rgba(255,255,255,0.2); border:none; padding:8px 14px; border-radius:8px; font-weight:bold; cursor:pointer;" ${currentIndex === totalRecords - 1 ? 'disabled style="opacity:0.4; cursor:default;"' : ''}>Next &rarr;</button>
        `;
        
        document.getElementById("prev-record-btn").addEventListener("click", () => {
            if (currentIndex > 0) {
                currentIndex--;
                displayDetails(appData[currentMode][currentIndex]);
            }
        });
        
        document.getElementById("next-record-btn").addEventListener("click", () => {
            if (currentIndex < totalRecords - 1) {
                currentIndex++;
                displayDetails(appData[currentMode][currentIndex]);
            }
        });
        navContainer.classList.remove("hidden");
    } else {
        navContainer.classList.add("hidden");
    }

    // NEW MODIFICATION INTEGRATION: Reset the inner content panel scroll tracking position to zero.
    // This forces long strings to snap perfectly back into alignment view instead of overflowing off-canvas.
    const contentBox = document.querySelector(".panel-content");
    if (contentBox) {
        contentBox.scrollTop = 0;
    }

    panel.classList.remove("hidden");
    document.body.classList.add("panel-open");
}

/**
 * Closes the details card and restores the primary landing image layout.
 */
function closeDetailsPanel() {
    const panel = document.getElementById("details-panel");
    const welcomeImage = document.getElementById("welcomeImage"); 
    
    if (panel) panel.classList.add("hidden");
    document.body.classList.remove("panel-open");
    
    // RESTORE STATE: Make the static foreground graphic reappear on layout exit
    if (welcomeImage) {
        welcomeImage.classList.remove("hidden");
    }
}

// =========================================================================
// 5. INTERACTION LOGIC & EVENT LISTENERS
// =========================================================================
function setupEventListeners() {
    const paidBtn = document.getElementById("btn-paid");
    const streetBtn = document.getElementById("btn-street");
    const closeBtn = document.getElementById("close-panel-btn");
    const searchInput = document.getElementById("search-input");
    const clearSearchBtn = document.getElementById("clear-search-btn");

    if (closeBtn) {
        closeBtn.addEventListener("click", closeDetailsPanel);
    }

    if (searchInput && clearSearchBtn) {
        searchInput.addEventListener("input", () => {
            clearSearchBtn.classList.toggle("hidden", searchInput.value.trim().length === 0);
        });
        clearSearchBtn.addEventListener("click", () => {
            searchInput.value = "";
            clearSearchBtn.classList.add("hidden");
            closeDetailsPanel(); // Automatically clean layout and restore welcomeImage
        });
    }

    if (paidBtn) {
        paidBtn.addEventListener("click", () => {
            currentMode = 'paid';
            currentIndex = 0; 
            paidBtn.classList.add("active");
            if (streetBtn) streetBtn.classList.remove("active");
            
            // Hide the welcome graphic if displaying active toggle cards
            const welcomeImage = document.getElementById("welcomeImage");
            if (appData.paid.length > 0) {
                if (welcomeImage) welcomeImage.classList.add("hidden");
                displayDetails(appData.paid[currentIndex]); 
            }
        });
    }

    if (streetBtn) {
        streetBtn.addEventListener("click", () => {
            currentMode = 'street';
            currentIndex = 0; 
            streetBtn.classList.add("active");
            if (paidBtn) paidBtn.classList.remove("active");
            
            // Hide the welcome graphic if displaying active toggle cards
            const welcomeImage = document.getElementById("welcomeImage");
            if (appData.street.length > 0) {
                if (welcomeImage) welcomeImage.classList.add("hidden");
                displayDetails(appData.street[currentIndex]); 
            }
        });
    }
}

// =========================================================================
// 6. SEARCH WORKBENCH ENGINE (WITH ACCELERATED IMAGE VISIBILITY TOGGLES)
// =========================================================================
function setupLocalSearchSimulation() {
    const searchBtn = document.getElementById("search-button");
    const searchInput = document.getElementById("search-input");
    const welcomeImage = document.getElementById("welcomeImage"); 
    
    if (!searchBtn) return;
    
    searchBtn.addEventListener("click", async () => {
        if (!searchInput || !searchInput.value.trim()) return;
        
        const searchTarget = searchInput.value.trim();
        searchBtn.innerText = "⚡ Loading...";
        searchBtn.disabled = true;

        // ACCELERATE STATE CHANGE: Instantly pop out foreground graphic layout to avoid UI overlapping
        if (welcomeImage) {
            welcomeImage.classList.add("hidden");
        }

        let liveResults = [];

        if (currentMode === 'paid') {
            liveResults = await fetchLiveGarageData(searchTarget);
        } else {
            liveResults = await fetchLiveStreetData(searchTarget);
        }

        if (liveResults && liveResults.length > 0) {
            console.log(`✨ Success: Received ${liveResults.length} real entries from NYC Open Data.`);
            appData[currentMode] = liveResults;
            currentIndex = 0; 
            displayDetails(appData[currentMode][currentIndex]);
        } else {
            alert(`No live open data records returned for "${searchTarget}".`);
            // BACKOUT STRATEGY: Bring the graphic layer back if API returns completely blank metrics
            if (welcomeImage) {
                welcomeImage.classList.remove("hidden");
            }
        }

        searchBtn.innerText = "Search";
        searchBtn.disabled = false;
    });
}

// Initialize Application Engine Instantly
initApp();