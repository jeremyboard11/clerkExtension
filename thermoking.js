const thermokingCache = {
    // data
    trailers: null,
    // promises
    trailersReady: null,
    // resolvers
    resolveTrailers: null
};

// --- main functions ---

// Initialize the promises and resolvers
thermokingCache.trailersReady = new Promise((resolve) => {
    thermokingCache.resolveTrailers = resolve;
});

function standardizeTrailerData(data) {
    // reduce so trailerCode is key
    return data['aaData'].reduce((acc, trailer) => {
        const trailerCode = trailer.vehicleName;
        
        acc[trailerCode] = {
            zones: { "nose": trailer.zones[0], "tail": trailer.zones[1] },
            ambientTemperature: trailer.ambientTemperature,
            reefer: trailer.reefer,
            updated: trailer.formattedDataDate,
            stationary: trailer.stationary,
            position: trailer.shortPosition,
            coordinates: { lat: trailer.latitude, lng: trailer.longitude },
            trailerCode: trailerCode
        };

        return acc;
    }, {});
}

// process incoming data and store in cache
function runTKData(payload) {
    const { type, data } = payload;
    if (type === 'trailers') {
        // store trailer data
        thermokingCache.trailers = standardizeTrailerData(data);
        // Resolve the trailer promise
        thermokingCache.resolveTrailers();

        console.log("Received thermoking trailer data:", thermokingCache.trailers);
    }
}

// ------ end main functions ------

// --- INITIALIZATION ---

async function init() {
    // load settings
    const { appSettings } = await chrome.storage.local.get('appSettings');
    if (!(appSettings && appSettings.scriptsEnabled)) {
        console.log("Clerk Extension is toggled off.");
        return;
    }
    console.log("Clerk Extension is enabled.");

    // Listen for incoming thermokig data
    window.addEventListener('THERMOKING_DATA_READY', (event) => {
        runTKData(event.detail);
    });

    // Listen for the Message from Prospero (Relayed via Background)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "REQUEST_THERMOKING_DATA") {
            console.log("Data requested for specific trailers:", message.trailers);

            // Start the async process
            (async () => {
                try {
                    // 1. Wait for the cache to be ready
                    await thermokingCache.trailersReady;

                    console.log("Data ready! Filtering and broadcasting.");

                    // --- FILTERING LOGIC START ---
                    let filteredData = {};

                    if (Array.isArray(message.trailers) && message.trailers.length > 0) {
                        // Iterate through the requested trailer codes
                        message.trailers.forEach(code => {
                            // Check if this code actually exists in our cache
                            if (thermokingCache.trailers[code]) {
                                filteredData[code] = thermokingCache.trailers[code];
                            } else {
                                console.warn(`Trailer code ${code} requested but not found in cache.`);
                            }
                        });
                    } else {
                        // If no specific trailers were requested, you might want to 
                        // send everything or nothing. Here we send everything as a fallback.
                        filteredData = thermokingCache.trailers;
                    }
                    // --- FILTERING LOGIC END ---

                    // 2. Broadcast the FILTERED data
                    chrome.runtime.sendMessage({
                        type: "THERMOKING_DATA",
                        payload: filteredData // Sending only requested trailers
                    });

                } catch (error) {
                    console.error("Error fetching thermoking data:", error);
                    
                    chrome.runtime.sendMessage({
                        type: "THERMOKING_DATA_ERROR",
                        error: error.message
                    });
                }
            })();
        }
    });

    // thermoking context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('thermoking-context.js');
    script.dataset.devThermokingDataUrl = chrome.runtime.getURL('@DEV/dev-thermoking-data.json');
    script.dataset.appSettings = JSON.stringify(appSettings);
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

init();