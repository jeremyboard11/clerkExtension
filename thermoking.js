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
        
        // --- PARSE STATIONARY TIME TO MINUTES ---
        let stationaryMinutes = 0;
        if (trailer.stationary) {
            const [hours, minutes, seconds] = trailer.stationary.split(':').map(Number);
            const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
            stationaryMinutes = Math.floor(totalSeconds / 60); 
        }
        // ----------------------------------------

        acc[trailerCode] = {
            zones: {
                "nose": {
                    setPoint: trailer.zones[0].setPoint ? parseInt(trailer.zones[0].setPoint) : null,
                    returnAir: trailer.zones[0].returnAir ? parseInt(trailer.zones[0].returnAir) : null,
                    dischargeAir: trailer.zones[0].dischargeAir ? parseInt(trailer.zones[0].dischargeAir) : null,
                    active: trailer.zones[0].active ? trailer.zones[0].active : null,
                    operatingMode: trailer.operatingMode1,
                },
                "tail": {
                    setPoint: trailer.zones[1].setPoint ? parseInt(trailer.zones[1].setPoint) : null,
                    returnAir: trailer.zones[1].returnAir ? parseInt(trailer.zones[1].returnAir) : null,
                    dischargeAir: trailer.zones[1].dischargeAir ? parseInt(trailer.zones[1].dischargeAir) : null,
                    active: trailer.zones[1].active ? trailer.zones[1].active : null,
                    operatingMode: trailer.operatingMode2,
                }
            },
            ambientTemperature: trailer.ambientTemperature ? parseInt(trailer.ambientTemperature, 10) : null,
            ignitionStatus: trailer.ignitionStatus,
            reefer: trailer.reefer,
            updated: trailer.formattedDataDate,
            stationaryMinutes: stationaryMinutes,
            position: trailer.shortPosition,
            coordinates: { lat: trailer.latitude, lng: trailer.longitude },
            trailerCode: trailerCode
        };

        return acc;
    }, {});
}

// process incoming data and store in cache
async function runTKData(type, data) {
    //const { type, data } = payload;
    if (type === 'trailers') {
		console.log("Processing trailer data...");
        // store trailer data
		await chrome.storage.local.set({
			thermokingTrailers: thermokingCache.trailers,
			thermokingLastUpdate: Date.now()
		});
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
        console.log("Received THERMOKING_DATA_READY event:", event.detail);
        runTKData(event.detail.type, event.detail.response);
    });

    // Store all trailers to local storage when ready
    // Prospero will read directly from storage without message passing
    (async () => {
        try {
            await thermokingCache.trailersReady;
            console.log("Thermoking data ready. Storing to local storage.");
            
            // Store the entire trailer cache to local storage
            await chrome.storage.local.set({
                thermokingTrailers: thermokingCache.trailers,
                thermokingLastUpdate: Date.now()
            });
        } catch (error) {
            console.error("Error storing thermoking data to local storage:", error);
        }
    })();

    // thermoking context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('thermoking-context.js');
    script.dataset.devThermokingDataUrl = chrome.runtime.getURL('@DEV/dev-thermoking-data.json');
    script.dataset.appSettings = JSON.stringify(appSettings);
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

init();