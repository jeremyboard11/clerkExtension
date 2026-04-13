/**
 * CLERK EXTENSION - Background Relay Station
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // 1. DIRECTION: Prospero -> Background -> ThermoKing
    if (message.type === "REQUEST_TEMPS") {
        console.log("Relaying Request: Prospero -> ThermoKing");
        broadcastToAllTabs(message);
    }

    // 2. DIRECTION: ThermoKing -> Background -> Prospero
    if (message.type === "TEMPS_RESULT") {
        console.log("Relaying Results: ThermoKing -> Prospero");
        broadcastToAllTabs(message);
    }
});

/**
 * Helper function to send a message to every open tab.
 * The content scripts will ignore any message types they aren't listening for.
 */
function broadcastToAllTabs(message) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            // We use .catch() because we don't want an error if a tab 
            // (like Google or YouTube) isn't part of our extension
            chrome.tabs.sendMessage(tab.id, message).catch(() => { });
        });
    });
}