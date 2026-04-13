/**
 * CLERK EXTENSION - ThermoKing Content Script
 */

let tkVehicles = []; // storage for temp data

function clerkLog(message) {
    console.log(`Clerk Extension (ThermoKing): ${message}`);
}

// --- DATA PROCESSING ---

function processTKData(data) {
    tkVehicles = data;
    clerkLog(`Received data from api for ${tkVehicles.length} trailers.`);
}

// --- INITIALIZE ---

function initialize() {
    // 1. Listen for the Sniffer
    window.addEventListener('THERMOKING_DATA_READY', (event) => {
        processTKData(event.detail);
    });

    // 2. Listen for the Message from Prospero (Relayed via Background)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "REQUEST_TEMPS") {
            
            // dev - log trailers requested
            //clerkLog(`Prospero requested temps for: ${message.trailers.join(', ')}`);
            
            // 2. Filter local sniffer data (tkVehicles) to find matches
            const matches = tkVehicles.filter(v => message.trailers.includes(v.vehicleName));

            chrome.runtime.sendMessage({
                type: "TEMPS_RESULT",
                payload: matches,
                requestId: message.requestId // SEND THE TOKEN BACK
            });

            clerkLog(`Sending data for ${message.trailers.length} trailers to prospero.`)
        }
    });

    // 3. Inject the Sniffer
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('thermoking_sniffer.js');
    script.dataset.sampleUrl = chrome.runtime.getURL('thermoking_samples.json');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

initialize();