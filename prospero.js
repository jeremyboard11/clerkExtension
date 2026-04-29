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

// ------------ UI HELPER FUNCTIONS ------------

window.renderDock = function({ notifications = [], temperatureMessages = [] } = {}) {
    let host = document.getElementById('temp-dock-host');
    let shadow;

    // --- INITIAL BOOTSTRAP (Runs once) ---
    if (!host) {
        host = document.createElement('div');
        host.id = 'temp-dock-host';
        document.documentElement.appendChild(host);
        shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            :host { --bg: #222; --accent: #eee; --text: #333; --err: #ff5c4d; --notif: #ffcc00; }
            #dock {
                position: fixed; top: 20px; right: 20px; z-index: 2147483647;
                background: var(--bg); color: var(--text); border-radius: 12px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3); padding: 10px;
                font-family: system-ui, sans-serif; cursor: grab; width: fit-content;
            }
            .btn-row { display: flex; gap: 10px; }
            button {
                background: #444; border: none; color: white; padding: 8px 14px;
                border-radius: 6px; cursor: pointer; font-weight: bold;
                position: relative; display: flex; align-items: center; gap: 5px;
            }
            button:hover { background: #555; }
            .badge {
                background: #ff4d4d; color: white; font-size: 10px;
                padding: 1px 6px; border-radius: 10px; min-width: 10px; text-align: center;
            }
            .content-area { 
                max-height: 400px; overflow-y: auto; display: none; margin-top: 10px; width: 340px; 
            }
            .content-area::-webkit-scrollbar {
                width: 10px;
            }

            .content-area::-webkit-scrollbar-track {
                background: #222;
                border-radius: 8px;
            }

            .content-area::-webkit-scrollbar-thumb {
                background: #666;
                border-radius: 8px;
                border: 2px solid #222;
            }

            .content-area::-webkit-scrollbar-thumb:hover {
                background: #888;
            }
            .item-card { border: 1px solid #777; background-color:#333; padding: 12px; font-size: 13px; border-radius: 8px; margin-bottom: 8px; }
            .item-card:hover { background-color: #444; }
            .header-line { font-weight: bold; color: var(--accent); margin-bottom: 4px; }
            .footer-line { font-size: 11px; color: #aaa; margin-top: 6px; }
            .err-txt { color: var(--err); font-size: 11px; margin-top: 3px; padding-left: 5px; }
            .notif-txt { color: var(--notif); font-style: italic; }
        `;

        const dock = document.createElement('div');
        dock.id = 'dock';
        dock.innerHTML = `
            <div class="btn-row">
                <button id="btn-notif">Notifications <span id="count-notif" class="badge">0</span></button>
                <button id="btn-temp">Temperature Issues <span id="count-temp" class="badge">0</span></button>
            </div>
            <div id="panel-notif" class="content-area"></div>
            <div id="panel-temp" class="content-area"></div>
        `;

        shadow.appendChild(style);
        shadow.appendChild(dock);

        // Draggable Logic
        let isDragging = false, ox, oy;
        dock.onmousedown = (e) => {
            if (e.target.closest('button')) return;
            isDragging = true;
            ox = e.clientX - dock.offsetLeft; oy = e.clientY - dock.offsetTop;
        };
        document.onmousemove = (e) => {
            if (!isDragging) return;
            dock.style.left = (e.clientX - ox) + 'px';
            dock.style.top = (e.clientY - oy) + 'px';
            dock.style.right = 'auto';
        };
        document.onmouseup = () => isDragging = false;

        // Toggle Logic
        const pTemp = shadow.querySelector('#panel-temp');
        const pNotif = shadow.querySelector('#panel-notif');
        
        shadow.querySelector('#btn-temp').onclick = () => {
            pTemp.style.display = pTemp.style.display === 'block' ? 'none' : 'block';
            pNotif.style.display = 'none';
        };
        shadow.querySelector('#btn-notif').onclick = () => {
            pNotif.style.display = pNotif.style.display === 'block' ? 'none' : 'block';
            pTemp.style.display = 'none';
        };
    } else {
        shadow = host.shadowRoot;
    }

    // --- PARTIAL RE-RENDER LOGIC ---

    // 1. Update Badge Counts
    shadow.querySelector('#count-notif').innerText = notifications.length;
    shadow.querySelector('#count-temp').innerText = temperatureMessages.length;

    // 2. Update Notification List
    const notifPanel = shadow.querySelector('#panel-notif');
    notifPanel.innerHTML = notifications.map(n => `
        <div class="item-card notif-txt">• ${n}</div>
    `).join('') || '<div class="item-card">No notifications</div>';

    // 3. Update Temperature List (Formatted: Trailer > Route > Door)
    const tempPanel = shadow.querySelector('#panel-temp');
    tempPanel.innerHTML = temperatureMessages.map(item => `
        <div class="item-card">
            <div class="header-line">
                Trailer: ${item.trailer} | Route: ${item.route} | Door: ${item.door} | Route Group: ${item.routeGroup}
            </div>
            ${item.errors.map(err => `<div class="err-txt">${err}</div>`).join('')}
            <div class="footer-line">Last Updated: ${item.updated ? new Date(item.updated).toLocaleString() : 'N/A'}</div>
            <div class="footer-line">Location: ${item.position || 'N/A'}</div>
        </div>
    `).join('') || '<div class="item-card">No temperature issues</div>';
};

// ------------ Data Cache and State Management ------------

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

function logStyled(message, type = "success") {
  const colors = {
    success: "#2ecc71",
    error:   "#e74c3c",
    warning: "#f39c12",
    info:    "#3498db",
    default: "#95a5a6"
  };

  const activeColor = colors[type] || colors.default;

  // Consistency is key: same padding, border, and weight for everything
  const style = [
    `color: ${activeColor}`,
    `font-weight: bold`,
    `border: 1px solid ${activeColor}`,
    `padding: 2px 5px`,
    `border-radius: 3px`
  ].join(';');

  console.log(`%c${message}`, style);
}

function standardizeRoutes(routes) {
    return routes.map(route => ({
        route: route.routeNum,
        shipment: route.customField03,
        routeGroup: prosperoCache.routeGroups[route.siteRouteGroupId],
        door: route.trailer1DoorNum,
        trailer: prosperoCache.trailers[route.trailer1OutId]?.code || "",
        plannedDispatchDate: route.plannedDispatchDate,
        tripId: route.tripId,
        deliverySequence: route.deliverySequence,
    }));
}

async function fetchThermokingData(trailerList) {
    if (trailerList.length === 0) return Promise.resolve({});

    // Try to get thermoking data from local storage
    const { thermokingTrailers, thermokingLastUpdate } = await chrome.storage.local.get(['thermokingTrailers', 'thermokingLastUpdate']);
    
    if (!thermokingTrailers) {
        logStyled("Thermoking data not available in local storage.", "warning");
        return {};
    }else{
        // Format the timestamp
        const lastUpdateTime = new Date(thermokingLastUpdate).toLocaleTimeString();
        logStyled(`Thermoking data loaded from local storage (Last updated: ${lastUpdateTime})`, "success");
    }

    // Filter for requested trailers
    let filteredData = {};
    trailerList.forEach(code => {
        if (thermokingTrailers[code]) {
            // add requested trailer data to filteredData object
            filteredData[code] = thermokingTrailers[code];
        } else {
            logStyled(`Trailer code ${code} not found in thermoking data.`, "warning");
        }
    });

    // return data for requested trailers only
    return filteredData;
}

async function checkTrailerTemps(routes, appSettings) {
    let notifications = [];

    logStyled("Checking trailer temps for " + routes.length + " routes.", "default");

    // filter out unknown trailers
    const trailerList = routes.map(r => r.trailer).filter(code => code && !code.toString().includes('Unknown'));
    
    let thermokingData;
    try {
        // fetch thermoking data from session storage
        thermokingData = await fetchThermokingData(trailerList);
    } catch (error) {
        console.error("Error fetching Thermoking data:", error);
        return;
    }

    // thermoking data received. loop through routes and check trailer temps

    routes.forEach(route => {
        // Skip routes with no trailer assigned
        if (!route.trailer) {
            return;
        }

        const trailerData = thermokingData[route.trailer];
        const requiredTemps = appSettings.tempRules[route.routeGroup.toLowerCase()]

        // Skip routes with no temp rules defined
        if (!requiredTemps) {return;}

        const issues = [];

        // notify if trailer is not found in thermoking data
        if(!trailerData){
            notifications.push({
                trailer: route.trailer,
                route: route.route,
                door: route.door,
                routeGroup: route.routeGroup,
                errors: ["Trailer "+route.trailer+" was not found in Thermoking"]
            })
            return;
        }

        // Safely access nose setpoint, use "?" if not found
        const noseSetPoint = trailerData?.zones?.nose?.setPoint;
        const noseActive = trailerData?.zones?.nose?.active;

        // trailer ignition off
        if(trailerData.ignitionStatus === "Off"){
            issues.push(`Trailer ignition is off, expected On`);
        }
        
        if (requiredTemps.nose !== null && !noseActive) {
            issues.push(`Nose reefer is not running, expected ${requiredTemps.nose}°`);
        } else if (requiredTemps.nose !== null && noseSetPoint === undefined) {
            issues.push(`Nose temp setpoint was not found, expected ${requiredTemps.nose}°`);
        } else if (requiredTemps.nose !== null && noseSetPoint !== requiredTemps.nose) {
            issues.push(`Nose temp setpoint is ${noseSetPoint}°, expected ${requiredTemps.nose}°`);
        }

        // Safely access tail setpoint, use "?" if not found
        const tailSetPoint = trailerData?.zones?.tail?.setPoint;
        const tailActive = trailerData?.zones?.tail?.active;
        
        if (requiredTemps.tail !== null && !tailActive) {
            issues.push(`Tail reefer is not running, expected ${requiredTemps.tail}°`);
        } else if (requiredTemps.tail !== null && tailSetPoint === undefined) {
            issues.push(`Tail temp setpoint was not found, expected ${requiredTemps.tail}°`);
        } else if (requiredTemps.tail !== null && tailSetPoint !== requiredTemps.tail) {
            issues.push(`Tail temp setpoint is ${tailSetPoint}°, expected ${requiredTemps.tail}°`);
        }

        if (issues.length > 0) {
            notifications.push({
                trailer: route.trailer,
                route: route.route,
                door: route.door,
                routeGroup: route.routeGroup,
                errors: issues,
                updated: trailerData.updated,
                position: trailerData.position
            });
        }
    });

    // Update dock UI with notifications and temp issues
    console.log("notifications: ",notifications);

    renderDock({
        notifications: ["System Maintenance at 5 PM", "New Route Assigned"],
        temperatureMessages: notifications
    });

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

async function runProsperoData(type, data, appSettings) {
    //const { type, data } = payload;
    
    // process route groups
    if(type === 'routeGroups') {
        let routeGroups = data['filterCategory'].filter(item => item?.code === 'RouteGroup')[0].filterEntry;
        // store route group data
        prosperoCache.routeGroups = Object.fromEntries(
            routeGroups.map(item => [item.id, item.desc])
        );
        
        // Also store to local storage for persistence
        await chrome.storage.local.set({
            prosperoRouteGroups: prosperoCache.routeGroups
        });
        
        logStyled("Updated route group cache", "info");
        // Resolve the routeGroup promise
        prosperoCache.resolveRouteGroups(); 
    }

    // process trailers
    if(type === 'trailer') {
        // store trailer data in memory
        prosperoCache.trailers = Object.fromEntries(
            data.map(trailer => [
                trailer.trailerId,
                {
                    code: trailer.trailerCode,
                    type: trailer.trailerDesc
                }
            ])
        );
        
        // Also store to local storage for persistence across page reloads
        await chrome.storage.local.set({
            prosperoTrailers: prosperoCache.trailers
        });
        
        logStyled("Updated trailer cache", "info");
        // Resolve the trailer promise
        prosperoCache.resolveTrailers();
    }

    // process routes (prospero route data received)
    if(type === 'listing') {
        logStyled("Received listing data. Attempting to load trailer and route group data.", "default");
        
        // Try to load route groups from local storage first
        const { prosperoRouteGroups } = await chrome.storage.local.get('prosperoRouteGroups');
        
        if (prosperoRouteGroups) {
            logStyled("Loaded route groups from local storage", "success");
            prosperoCache.routeGroups = prosperoRouteGroups;
        } else {
            logStyled("Route groups not in local storage, waiting for route group data event.", "warning");
            await prosperoCache.routeGroupsReady;
        }
        
        // Try to load trailers from local storage first
        const { prosperoTrailers } = await chrome.storage.local.get('prosperoTrailers');
        
        if (prosperoTrailers) {
            logStyled("Loaded trailers from local storage", "success");
            prosperoCache.trailers = prosperoTrailers;
        } else {
            logStyled("Trailers not in local storage, waiting for trailer data event.", "warning");
            // Fallback: wait for trailer data to arrive
            await prosperoCache.trailersReady;
        }
        
        // standardize and store route data
        prosperoCache.routes = standardizeRoutes(data);
        console.log("Received listing data:", prosperoCache.routes);

        // check trailer temps
        await checkTrailerTemps(prosperoCache.routes, appSettings);
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
        if(!event.detail.response){return}
        appSettings.devMode ? console.log("(Dev Mode): Running prospero data: ", event.detail.type) : null;
        runProsperoData(event.detail.type, event.detail.response, appSettings);
    });

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