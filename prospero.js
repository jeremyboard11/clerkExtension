/**
 * CLERK EXTENSION - Prospero Content Script
 */

let routes = [];
let tkVehicles = [];
let trailerMap = new Map();
let currentRequestId = 0; // Token to track the latest request

function clerkLog(message) {
    console.log(`Clerk Extension (Prospero): ${message}`);
}

// --- DATA STORAGE ---

function storeTrailers(trailerArray) {
    trailerMap.clear();
    trailerArray.forEach(t => trailerMap.set(t.trailerId, t.trailerCode));
    clerkLog(`Mapped ${trailerMap.size} trailers.`);
}

function getTrailerCode(id) {
    return trailerMap.get(id) || `Unknown (${id})`;
}

// --- CORE PROCESSOR ---

function compareRouteTrailerTemps(){
    if(routes && tkVehicles){
        // compare trailers in prospero to thermoking data. alert user if trailer temps are set incorrectly.
        routes.forEach(row => {
            // TODO: find out if theres a xhr request for route group id reference table
            if(row.siteRouteGroupId == 58){
                console.log("mix")
            }
        })
    }
}

function processProsperoData(payload) {
    const { type, data } = payload;

    if (type === 'trailers') {
        storeTrailers(data);
    }

    if (type === 'listing') {
        console.clear();
        routes = data;
        clerkLog(`Updated: ${routes.length} routes.`);

        // Request temps immediately when listing updates
        fetchTrailerTemps();
    }
}

// --- THERMOKING INTEGRATION ---

function fetchTrailerTemps() {
    const trailerList = routes
        .map(trip => getTrailerCode(trip.trailer1OutId))
        .filter(code => code && !code.toString().includes('Unknown'));

    if (trailerList.length === 0) return;

    // Increment ID so we only care about THIS specific request
    currentRequestId = Date.now();

    chrome.runtime.sendMessage({
        type: "REQUEST_TEMPS",
        trailers: trailerList,
        requestId: currentRequestId // Attach the token
    });

    clerkLog(`Requesting temps (ID: ${currentRequestId}) for ${trailerList.length} trailers.`);
}

// --- INITIALIZE ---

function initialize() {
    chrome.storage.sync.get(['scriptsEnabled'], (settings) => {
        if (settings.scriptsEnabled === false) return;

        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === "TEMPS_RESULT") {
                // IGNORE CHECK: If this result is for an old request, discard it
                if (message.requestId !== currentRequestId) {
                    clerkLog(`Discarded stale response (ID: ${message.requestId})`);
                    return;
                }

                tkVehicles = message.payload;
                clerkLog(`Temps received for ${tkVehicles.length} units (Match: ${message.requestId}).`);

                //verify trailer temps are set correctly after prospero ('listing') and thermoking ('getData') are received
                compareRouteTrailerTemps(routes, tkVehicles);
            }
        });

        // Fetch trailer tamps at interval
        // setInterval(fetchTrailerTemps, 10000);

        window.addEventListener('PROSPERO_DATA_READY', (event) => {
            processProsperoData(event.detail);
        });

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('prospero_sniffer.js');
        script.dataset.sampleUrl = chrome.runtime.getURL('sample_data.json');
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
    });
}

initialize();