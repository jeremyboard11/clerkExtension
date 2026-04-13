// /**
//  * CLERK EXTENSION - Prospero Content Script
//  */

// let routes = [];
// let tkVehicles = [];
// let trailerMap = new Map();
// let currentRequestId = 0; // Token to track the latest request

// function clerkLog(message) {
//     console.log(`Clerk Extension (Prospero): ${message}`);
// }

// // --- DATA STORAGE ---

// function storeTrailers(trailerArray) {
//     trailerMap.clear();
//     trailerArray.forEach(t => trailerMap.set(t.trailerId, t.trailerCode));
//     clerkLog(`Mapped ${trailerMap.size} trailers.`);
// }

// function getTrailerCode(id) {
//     return trailerMap.get(id) || `Unknown (${id})`;
// }

// // --- CORE PROCESSOR ---

// function compareRouteTrailerTemps(){
//     if(routes && tkVehicles){
//         // compare trailers in prospero to thermoking data. alert user if trailer temps are set incorrectly.
//         routes.forEach(row => {
//             // TODO: find out if theres a xhr request for route group id reference table
//             if(row.siteRouteGroupId == 58){
//                 console.log("mix")
//             }
//         })
//     }
// }

// function processProsperoData(payload) {
//     const { type, data } = payload;

//     if (type === 'trailers') {
//         storeTrailers(data);
//     }

//     if (type === 'listing') {
//         console.clear();
//         routes = data;
//         clerkLog(`Updated: ${routes.length} routes.`);

//         // Request temps immediately when listing updates
//         fetchTrailerTemps();
//     }
// }

// // --- THERMOKING INTEGRATION ---

// function fetchTrailerTemps() {
//     const trailerList = routes
//         .map(trip => getTrailerCode(trip.trailer1OutId))
//         .filter(code => code && !code.toString().includes('Unknown'));

//     if (trailerList.length === 0) return;

//     // Increment ID so we only care about THIS specific request
//     currentRequestId = Date.now();

//     chrome.runtime.sendMessage({
//         type: "REQUEST_TEMPS",
//         trailers: trailerList,
//         requestId: currentRequestId // Attach the token
//     });

//     clerkLog(`Requesting temps (ID: ${currentRequestId}) for ${trailerList.length} trailers.`);
// }

// // --- INITIALIZE ---

// function initialize() {
//     chrome.storage.sync.get(['scriptsEnabled'], (settings) => {
//         if (settings.scriptsEnabled === false) return;

//         chrome.runtime.onMessage.addListener((message) => {
//             if (message.type === "TEMPS_RESULT") {
//                 // IGNORE CHECK: If this result is for an old request, discard it
//                 if (message.requestId !== currentRequestId) {
//                     clerkLog(`Discarded stale response (ID: ${message.requestId})`);
//                     return;
//                 }

//                 tkVehicles = message.payload;
//                 clerkLog(`Temps received for ${tkVehicles.length} units (Match: ${message.requestId}).`);

//                 //verify trailer temps are set correctly after prospero ('listing') and thermoking ('getData') are received
//                 compareRouteTrailerTemps(routes, tkVehicles);
//             }
//         });

//         // Fetch trailer tamps at interval
//         // setInterval(fetchTrailerTemps, 10000);

//         window.addEventListener('PROSPERO_DATA_READY', (event) => {
//             processProsperoData(event.detail);
//         });

//         const script = document.createElement('script');
//         script.src = chrome.runtime.getURL('prospero_sniffer.js');
//         script.dataset.sampleUrl = chrome.runtime.getURL('sample_data.json');
//         script.onload = () => script.remove();
//         (document.head || document.documentElement).appendChild(script);
//     });
// }

// initialize();

const prosperoCache = {
    // --- ACTUAL DATA ---
    routeGroups: null, 
    trailers: null, 
    routes: null,

    // --- Promises ---
    routeGroupsReady: null,
    trailersReady: null,

    // --- RESOLVERS (Functions to trigger the signals) ---
    resolveRouteGroups: null,
    resolveTrailers: null
};

// ------------ main functions ------------
function standardizeRoutes(routes) {
    return routes.map(route => ({
        route: route.routeNum,
        shipment: route.customField03,
        routeGroup: prosperoCache.routeGroups[route.siteRouteGroupId],
        door: route.trailer1DoorNum,
        trailer: prosperoCache.trailers[route.trailer1OutId]?.code || `Unknown`,
        plannedDispatchDate: route.plannedDispatchDate,
        tripId: route.tripId,
        deliverySequence: route.deliverySequence,
    }));
}

function fetchThermokingData(trailerList, requestId) {
    if (trailerList.length === 0) return Promise.resolve({});

    return new Promise((resolve, reject) => {
        // listener for thermoking results
        const messageListener = (message) => {
            if (message.type === "THERMOKING_DATA") {
                cleanup();
                resolve(message.payload); 
            } else if (message.type === "THERMOKING_DATA_ERROR") {
                cleanup();
                reject(new Error(message.error));
            }
        };

        const cleanup = () => {
            chrome.runtime.onMessage.removeListener(messageListener);
        };

        // Start listener
        chrome.runtime.onMessage.addListener(messageListener);

        // Request thermoking data for specific trailers
        chrome.runtime.sendMessage({
            type: "REQUEST_THERMOKING_DATA",
            trailers: trailerList,
            requestId: requestId
        });

        // Timeout to prevent hanging
        setTimeout(() => {
            cleanup();
            reject(new Error("Thermoking data request timed out."));
        }, 15000);
    });
}

async function checkTrailerTemps(routes, tempRules) {
    // filter out unknown trailers
    const trailerList = routes.map(r => r.trailer).filter(code => code && !code.toString().includes('Unknown'));
    
    let thermokingData;
    try {
        // fetch and set thermoking data
        thermokingData = await fetchThermokingData(trailerList, Date.now());
    } catch (error) {
        console.error("Error fetching Thermoking data:", error);
        return;
    }

    // Process thermoking data
    console.log("tempRules:", tempRules);
}
// ------ end main functions ------


// ------------ Initialization ------------

// Ensures route groups are loaded before processing listing data, since route group names are needed to standardize routes
prosperoCache.routeGroupsReady = new Promise((resolve) => {
    prosperoCache.resolveRouteGroups = resolve;
});

prosperoCache.trailersReady = new Promise((resolve) => {
    prosperoCache.resolveTrailers = resolve;
});

async function runProsperoData(payload, appSettings) {
    const { type, data } = payload;
    
    // process route groups
    if(type === 'routeGroups') {
        let routeGroups = data['filterCategory'].filter(item => item?.code === 'RouteGroup')[0].filterEntry;
        // store route group data
        prosperoCache.routeGroups = Object.fromEntries(
            routeGroups.map(item => [item.id, item.desc])
        );
        // Resolve the routeGroup promise
        prosperoCache.resolveRouteGroups(); 
        console.log("Received route group data:", prosperoCache.routeGroups);
    }

    // process trailers
    if(type === 'trailers') {
        // store trailer data
        prosperoCache.trailers = Object.fromEntries(
            data.map(trailer => [
                trailer.trailerId,
                {
                    code: trailer.trailerCode,
                    type: trailer.trailerDesc
                }
            ])
        );
        // Resolve the trailer promise
        prosperoCache.resolveTrailers();
        console.log("Received trailer data:", prosperoCache.trailers);
    }

    // process routes (prospero route data received)
    if(type === 'listing') {
        await Promise.all([
            prosperoCache.routeGroupsReady, 
            prosperoCache.trailersReady
        ]);
        
        // standardize and store route data
        prosperoCache.routes = standardizeRoutes(data);
        console.log("Received listing data:", prosperoCache.routes);

        // check trailer temps
        await checkTrailerTemps(prosperoCache.routes, appSettings.tempRules);
    }
}

async function init() {
    // load settings
    const { appSettings } = await chrome.storage.local.get('appSettings');
    if (!(appSettings && appSettings.scriptsEnabled)) {
        console.log("Clerk Extension is toggled off.");
        return;
    }
    console.log("Clerk Extension is enabled.", appSettings);

    // listen for incoming prospero data (trailers, listing, etc)
    window.addEventListener('PROSPERO_DATA_READY', (event) => {
        runProsperoData(event.detail, appSettings);
    });

    // listen for thermoking temp results

    // Prospero Context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('prospero-context.js');
    script.dataset.devProsperoDataUrl = chrome.runtime.getURL('@DEV/dev-prospero-data.json');
    script.dataset.devProsperoRouteGroupsUrl = chrome.runtime.getURL('@DEV/dev-prospero-routeGroups.json');
    script.dataset.devProsperoTrailersUrl = chrome.runtime.getURL('@DEV/dev-prospero-trailers.json');
    script.dataset.appSettings = JSON.stringify(appSettings);
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

init();