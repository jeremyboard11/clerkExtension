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

window.renderDock = function({ newNotifications = [], dismissedNotifications = [], temperatureMessages = [] } = {}) {
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
            .item-card { border: 1px solid #777; background-color:#333; padding: 12px; font-size: 13px; border-radius: 8px; margin-bottom: 8px; display: block; }
            .item-card:hover { background-color: #444; }
            .item-card[data-type="new"], .item-card[data-type="dismissed"] { display: flex; align-items: center; }
            .item-card[data-type="dismissed"] { background-color: #2b2b2b; border-color: #555; opacity: 0.85; }
            .item-card[data-type="dismissed"] .notif-txt { color: #999; font-style: normal; }
            .item-card[data-type="dismissed"] .dismiss-btn { background: #444; }
            .temp-card { display: block; }
            .header-line { font-weight: bold; color: var(--accent); margin-bottom: 8px; }
            .temp-issues { margin: 8px 0; padding-left: 12px; }
            .temp-issues .issue-item { margin: 4px 0; font-size: 12px; color: #eee; }
            .temp-issues .issue-item::before { content: '• '; color: var(--notif); }
            .footer-line { font-size: 11px; color: #aaa; margin-top: 6px; }
            .err-txt { color: var(--err); font-size: 11px; margin-top: 3px; padding-left: 5px; }
            .notif-txt { color: var(--notif); font-style: italic; flex: 1; }
            .section { margin-bottom: 10px; }
            .section h4 { margin: 0 0 5px 0; color: var(--accent); font-size: 14px; }
            .dismiss-btn { margin-left: auto; background: #666; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px; }
            .dismiss-btn:hover { background: #888; }
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

    // Update current state
    currentNewNotifications = newNotifications;
    currentDismissedNotifications = dismissedNotifications;
    currentTemperatureMessages = temperatureMessages;

    // --- PARTIAL RE-RENDER LOGIC ---

    // 1. Update Badge Counts
    shadow.querySelector('#count-notif').innerText = newNotifications.length;
    shadow.querySelector('#count-temp').innerText = temperatureMessages.length;

    // 2. Update Notification List
    const notifPanel = shadow.querySelector('#panel-notif');
    notifPanel.innerHTML = `
        <div class="section">
            <h4>New Notifications</h4>
            ${newNotifications.map(n => `
                <div class="item-card" data-type="new">
                    <span class="notif-txt">${n}</span>
                    <button class="dismiss-btn">Dismiss</button>
                </div>
            `).join('') || '<div class="item-card">No new notifications</div>'}
        </div>
        <div class="section">
            <h4>Dismissed Notifications</h4>
            ${dismissedNotifications.map(n => `
                <div class="item-card" data-type="dismissed">
                    <span class="notif-txt">${n}</span>
                </div>
            `).join('') || '<div class="item-card">No dismissed notifications</div>'}
        </div>
    `;

    // Add dismiss event listeners
    notifPanel.querySelectorAll('.dismiss-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.item-card');
            const text = card.querySelector('.notif-txt').textContent.replace('• ', '').trim();
            const type = card.dataset.type;
            if (type === 'new') {
                currentNewNotifications.splice(currentNewNotifications.indexOf(text), 1);
                currentDismissedNotifications.unshift(text);
            } else {
                currentDismissedNotifications.splice(currentDismissedNotifications.indexOf(text), 1);
            }
            chrome.storage.local.set({ dismissedNotifications: currentDismissedNotifications });
            renderDock({
                newNotifications: currentNewNotifications,
                dismissedNotifications: currentDismissedNotifications,
                temperatureMessages: currentTemperatureMessages
            });
        });
    });

    // 3. Update Temperature List (Formatted: Trailer > Route > Door)
    const tempPanel = shadow.querySelector('#panel-temp');
    tempPanel.innerHTML = temperatureMessages.map(item => `
        <div class="item-card temp-card">
            <div class="header-line">Trailer: ${item.trailer} | Route: ${item.route} | Door: ${item.door} | Route Group: ${item.routeGroup}</div>
            <div class="temp-issues">
                ${((item.errors || []).length ? (item.errors || []).map(err => `<div class="issue-item">${err}</div>`).join('') : '<div class="issue-item">No issues found.</div>')}
            </div>
            <div class="footer-line">Last Updated: ${item.updated ? new Date(item.updated).toLocaleString() : 'N/A'}</div>
            <div class="footer-line">Location: ${item.position || 'N/A'}</div>
        </div>
    `).join('') || '<div class="item-card">No temperature issues</div>';
};

// ------------ Data Cache and State Management ------------

let currentNewNotifications = [];
let currentDismissedNotifications = [];
let currentTemperatureMessages = [];

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
    const formatTime = (isoString) => {
        if (!isoString) return "";
        const date = new Date(isoString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}/${day} ${hours}:${minutes}`;
    };

    return routes.map(route => ({
        route: route.routeNum,
        shipment: route.customField03,
        routeGroup: prosperoCache.routeGroups[route.siteRouteGroupId],
        door: route.trailer1DoorNum,
        trailer: prosperoCache.trailers[route.trailer1OutId]?.code || "",
        plannedDispatchDate: route.plannedDispatchDate,
        displayedDispatchDate: formatTime(route.plannedDispatchDate),
        tripId: route.tripId,
        deliverySequence: route.deliverySequence,
    }));
}

async function processRoutes(routes, appSettings) {
    const doorUsage = {};
    const repeatedDoors = new Set();

    let generalNotifications = [];
    let tempNotifications = [];

    // Load Yard and Thermoking data from chrome local storage
    const { yardTrailers, thermokingTrailers, thermokingLastUpdate, yardLastUpdate } = await chrome.storage.local.get(['yardTrailers', 'thermokingTrailers', 'thermokingLastUpdate', 'yardLastUpdate']);

    // Verify thermoking data
    if (!thermokingTrailers) {
        logStyled("Thermoking data not available in local storage.", "warning");
        return;
    }else{
        const thermokingLastUpdateTime = new Date(thermokingLastUpdate).toLocaleString();
        logStyled(`Thermoking data loaded from local storage (Last updated: ${thermokingLastUpdateTime})`, "success");
    }

    // Verify yard data
    if (!yardTrailers) {
        logStyled("Yard data not available in local storage. All trailers will be processed without yard context.", "warning");
        return;
    }else{
        const yardLastUpdateTime = new Date(yardLastUpdate).toLocaleString();
        logStyled(`Yard data loaded from local storage (Last updated: ${yardLastUpdateTime})`, "success");
    }

    // Loop through routes
    routes.forEach(route => {
        
        const trailerData = thermokingTrailers[route.trailer];
        const requiredTemps = appSettings.tempRules[route.routeGroup.toLowerCase()];
        const yardPad = yardTrailers[route.trailer]?.pad ?? "Not in Yard";
        let trailerInDoor = false;
        
        // Skip routes with no trailer assigned
        if (!route.trailer) {return;}
        
        // Skip routes with no door assigned
        if (!route.door) {return;}
        
        // Is trailer in final door? (if yard data is available)
        if (yardPad == route.door) {trailerInDoor = true;}
        
        // Skip routes with no temp rules defined (If it's not a PDIFRSH, PDIFRZ or MIX route)
        if (!requiredTemps) {return;}
        
        // If no thermoking data for the trailer, add a notification
        if(!trailerData){
            tempNotifications.push({
                trailer: route.trailer,
                route: route.route,
                door: route.door,
                routeGroup: route.routeGroup,
                errors: ["Trailer " + route.trailer + " was not found in Thermoking"]
            });
        }
        
        // -------- Check trailer temperature ---------
        if(trailerData && trailerInDoor){
            console.log("Processing trailer " + route.trailer + " on route " + route.route + " with door " + route.door);
            const issues = [];
            const noseSetPoint = trailerData?.zones?.nose?.setPoint;
            const noseActive = trailerData?.zones?.nose?.active;
            const tailSetPoint = trailerData?.zones?.tail?.setPoint;
            const tailActive = trailerData?.zones?.tail?.active;

            // check ignition status
            if(trailerData.ignitionStatus === "Off"){
                issues.push(`Trailer ignition is off, expected On`);
            }

            // check nose temps
            if (requiredTemps.nose !== null && !noseActive) {
                issues.push(`Nose reefer is not running, expected ${requiredTemps.nose}°`);
            } else if (requiredTemps.nose !== null && noseSetPoint === undefined) {
                issues.push(`Nose temp setpoint was not found, expected ${requiredTemps.nose}°`);
            } else if (requiredTemps.nose !== null && noseSetPoint !== requiredTemps.nose) {
                issues.push(`Nose temp setpoint is ${noseSetPoint}°, expected ${requiredTemps.nose}°`);
            }
            // check tail temps
            if (requiredTemps.tail !== null && !tailActive) {
                issues.push(`Tail reefer is not running, expected ${requiredTemps.tail}°`);
            } else if (requiredTemps.tail !== null && tailSetPoint === undefined) {
                issues.push(`Tail temp setpoint was not found, expected ${requiredTemps.tail}°`);
            } else if (requiredTemps.tail !== null && tailSetPoint !== requiredTemps.tail) {
                issues.push(`Tail temp setpoint is ${tailSetPoint}°, expected ${requiredTemps.tail}°`);
            }

            // push to tempNotifications if any issues found
            if (issues.length > 0) {
                tempNotifications.push({
                    trailer: route.trailer,
                    route: route.route,
                    door: route.door,
                    routeGroup: route.routeGroup,
                    errors: issues,
                    updated: trailerData.updated,
                    position: trailerData.position
                });
            }
        }

        // Add to door usage map for general notifications (e.g. repeated use of same door)
        const routeTime = Date.parse(route.plannedDispatchDate);
        if (!doorUsage[route.door]) {
            doorUsage[route.door] = [];
        }
        doorUsage[route.door].push({ route: route.route, time: routeTime });
        if (doorUsage[route.door].length > 1) {
            repeatedDoors.add(route.door);
        }

    });

    // Check for repeated door usage and add to general notifications
    repeatedDoors.forEach(door => {
        const entries = doorUsage[door].slice().sort((a, b) => a.time - b.time);
        const sequence = [];

        for (let i = 0; i < entries.length; i++) {
            sequence.push(entries[i].route);
            if (i < entries.length - 1) {
                const gapHours = Math.round((entries[i + 1].time - entries[i].time) / 3600000);
                sequence.push(`${gapHours}h`);
            }
        }

        generalNotifications.push(`Door ${door} is repeated: ${sequence.join(' > ')}`);
    });


    console.log("repeated doors:", doorUsage);
    console.log("Temperature issue notifications:", tempNotifications);

    // Clean up dismissed notifications that are no longer relevant
    currentDismissedNotifications = currentDismissedNotifications.filter(notif => {
        if (!notif.startsWith('Door ')) return true; // keep non-door notifications
        const parts = notif.split(' is repeated: ');
        if (parts.length !== 2) return true;
        const door = parts[0].replace('Door ', '');
        const sequence = parts[1].split(' > ');
        const routes = sequence.filter(s => !s.endsWith('h')).map(s => s.trim());
        // Check if all routes are still assigned to this door
        const currentRoutesForDoor = doorUsage[door] ? doorUsage[door].map(e => e.route) : [];
        return routes.every(r => currentRoutesForDoor.includes(r));
    });

    // Update storage with cleaned dismissed notifications
    chrome.storage.local.set({ dismissedNotifications: currentDismissedNotifications });

    currentNewNotifications = generalNotifications.filter(n => !currentDismissedNotifications.includes(n));
    currentTemperatureMessages = tempNotifications;

    renderDock({
        newNotifications: currentNewNotifications,
        dismissedNotifications: currentDismissedNotifications,
        temperatureMessages: currentTemperatureMessages
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
        await processRoutes(prosperoCache.routes, appSettings);
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

    // load dismissed notifications
    const { dismissedNotifications: storedDismissed } = await chrome.storage.local.get('dismissedNotifications');
    currentDismissedNotifications = storedDismissed || [];

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
