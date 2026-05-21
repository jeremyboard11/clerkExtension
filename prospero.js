// ------------ UI HELPER FUNCTIONS ------------

window.renderDock = async function(args = {}) {
    const { renderDock } = await import(chrome.runtime.getURL('floating-dock.js'));
    renderDock({
        ...args,
        currentAppSettings
    });
};

// ------------ Data Cache and State Management ------------

let stopLocations = {};
window.getStopLocations = async function() {
    const response = await fetch(chrome.runtime.getURL('@DEV/dev-stop-locations.json'));
    const data = await response.json();
    stopLocations = data.reduce((accumulator, currentCategory) => {
        const namesArray = currentCategory.filterEntry.map(entry => entry.desc);
        accumulator[currentCategory.name] = namesArray;
        return accumulator;
    }, {});
};

let currentNewNotifications = [];
let currentDismissedNotifications = [];
let currentSnoozedNotifications = [];
let currentTemperatureMessages = [];
let currentAppSettings = {};

function getNotificationText(notification) {
    if (typeof notification === 'string') return notification;
    if (!notification) return '';
    if (typeof notification.text === 'string' && notification.text) return notification.text;
    if (typeof notification.header === 'string' && notification.header) return notification.header;
    if (notification.type === 'doorRepeat' && notification.header) return notification.header;
    return '';
}

function normalizeDismissedNotifications(entries) {
    if (!Array.isArray(entries)) return [];
    return entries.map(entry => {
        if (typeof entry === 'string') {
            return { text: entry, dismissedAt: Date.now() };
        }

        const base = {
            text: entry?.text || entry?.header || '',
            dismissedAt: entry?.dismissedAt || Date.now()
        };

        if (entry?.type === 'doorRepeat') {
            base.type = 'doorRepeat';
            base.header = entry.header;
            base.door = entry.door;
            base.count = entry.count;
            base.routeEntries = entry.routeEntries;
        }

        return base;
    }).filter(entry => entry.text);
}

function formatDispatchTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
}

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
    const validGroups = ["PDIFRSH", "PDIFRZ", "MIX"];

    const formatTime = (isoString) => {
        if (!isoString) return "";
        const date = new Date(isoString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}/${day} ${hours}:${minutes}`;
    };

    const cleanDoor = (str) => str?.replace(/[A-Za-z]+$/, '') || "";

    return routes
        // 1. Filter out routes where the group name isn't in our allowed list
        .filter(route => {
            const groupName = prosperoCache.routeGroups[route.siteRouteGroupId];
            return validGroups.includes(groupName);
        })
        // 2. Map the remaining valid routes to your standard format
        .map(route => ({
            route: route.routeNum,
            shipment: route.customField03,
            routeGroup: prosperoCache.routeGroups[route.siteRouteGroupId],
            door: cleanDoor(route.trailer1DoorNum),
            trailer: prosperoCache.trailers[route.trailer1OutId]?.code || "",
            plannedDispatchDate: route.plannedDispatchDate,
            displayedDispatchDate: formatTime(route.plannedDispatchDate),
            readyTime: route.trailer1ReadyTime,
            tripId: route.tripId,
            deliverySequence: route.deliverySequence,
        }));
}

async function processRoutes(routes, appSettings) {
    console.log("stop locations", stopLocations);
    const doorUsage = {};
    const repeatedDoors = new Set();

    let generalNotifications = [];
    let tempNotifications = [];

    // Load Yard and Thermoking data from chrome local storage
    const { yardTrailers, thermokingTrailers, thermokingLastUpdate, yardLastUpdate } = await chrome.storage.local.get(['yardTrailers', 'thermokingTrailers', 'thermokingLastUpdate', 'yardLastUpdate']);

    // Load snoozed notifications
    const { snoozedNotifications: storedSnoozed } = await chrome.storage.local.get('snoozedNotifications');
    currentSnoozedNotifications = storedSnoozed || [];

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

    // Clear dismissed notifications that are 10 hours or older
    const now = Date.now();
    const retentionMs = 10 * 60 * 60 * 1000;
    currentDismissedNotifications = currentDismissedNotifications.filter(entry => {
        const dismissedAt = entry?.dismissedAt || now;
        return now - dismissedAt < retentionMs;
    });
    chrome.storage.local.set({ dismissedNotifications: currentDismissedNotifications });

    // --------------------- Loop through routes -----------------------
    routes.forEach(route => {
		// prototype wms load data
        const loadData = {
            route: route.route,
            shipment: route.shipment,
            batchesLoaded: 2,
            batchesStaged: 10,
            batchesInProgress: 5            
        }
        
        const trailerData = thermokingTrailers[route.trailer];
        console.log(trailerData);
        const requiredTemps = appSettings.tempRules[route.routeGroup.toLowerCase()];
        const yardPad = yardTrailers[route.trailer]?.pad ?? "Not in Yard";
        let trailerInDoor = (yardPad == route.door);

        // Skip routes with no temp rules defined (If it's not a PDIFRSH, PDIFRZ or MIX route)
        if (!requiredTemps) {return;}
        
        // ------------ Notify of Fast and Fresh routes ------------
        if(appSettings.prospero_ffDoorReminders && route.deliverySequence.includes(" FF")){
            generalNotifications.push(`Route ${route.route} is a Fast and Fresh route. Use liftgate at B03 - B06.`);
        }
        
        // ------------ Notify route lockdown time (within 2 hours of planned dispatch) ------------
        if (appSettings.prospero_lockdownReminders && route.plannedDispatchDate) {
            const plannedDispatchTime = new Date(route.plannedDispatchDate);
            const now = new Date();
            const timeDiff = (plannedDispatchTime - now) / (1000 * 60 * 60); // in hours
            const notificationText = `Lock down route ${route.route}. Planned dispatch: ${route.displayedDispatchDate}`;
            
            if (timeDiff >= 0 && timeDiff <= 2) {
                // Check if this exact notification is already snoozed or already in notifications
                if (!currentSnoozedNotifications.some(s => s.notification.route === route.route && s.notification.text === notificationText) &&
                !generalNotifications.some(n => n.route === route.route && n.text === notificationText)) {
                    generalNotifications.push({
                        type: 'snoozable',
                        text: notificationText,
                        route: route.route,
                        plannedDispatch: route.plannedDispatchDate
                    });
                }
            }
        }

        // ------------ Notify route closing time (within 30 minutes of planned dispatch) ------------
        if (appSettings.prospero_closeRouteReminders && !route.readyTime) {
            const plannedDispatchTime = new Date(route.plannedDispatchDate);
            const now = new Date();
            const timeDiff = (plannedDispatchTime - now) / (1000 * 60); // in minutes
            const notificationText = `Close route ${route.route}. Planned dispatch: ${route.displayedDispatchDate}`;
            
            if (timeDiff >= -600 && timeDiff <= 30) {
                // Check if this exact notification is already snoozed or already in notifications
                if (!currentSnoozedNotifications.some(s => s.notification.route === route.route && s.notification.text === notificationText) &&
                !generalNotifications.some(n => n.route === route.route && n.text === notificationText)) {
                    generalNotifications.push({
                        type: 'snoozable',
                        text: notificationText,
                        route: route.route,
                        plannedDispatch: route.plannedDispatchDate
                    });
                }
            }
        }
        
        // ------------ Notify of missing thermoking data for trailer ------------
        if(appSettings.prospero_tracking && route.trailer && !trailerData){
            generalNotifications.push(`No trailer temp data available for trailer ${route.trailer} on route ${route.route} (door ${route.door}).`);
        }

        // -------- Notify of trailer temp issues ---------
        if(appSettings.prospero_tracking && trailerData && trailerInDoor && route.trailer && route.door){
            const issues = [];
            const noseSetPoint = trailerData?.zones?.nose?.setPoint;
            const noseActive = trailerData?.zones?.nose?.active;
            const tailSetPoint = trailerData?.zones?.tail?.setPoint;
            const tailActive = trailerData?.zones?.tail?.active;
            let setpointIssue = false;

            // check ignition status
            if(trailerData.ignitionStatus === "Off"){
                issues.push(`Trailer ignition is off, expected On`);
            }

            // check nose setpoint
            if (requiredTemps.nose !== null && !noseActive) {
                setpointIssue = true;
                issues.push(`Nose reefer is not running, expected ${requiredTemps.nose}°`);
            } else if (requiredTemps.nose !== null && noseSetPoint !== requiredTemps.nose) {
                // allow colder nose setpoints for PDIFRZ and MIX routes (ex. trailer was already in door and set to -20 instead of -18)
                if (noseSetPoint > requiredTemps.nose && (route.routeGroup === "PDIFRZ" || route.routeGroup === "MIX")) {
                    setpointIssue = true;
                    issues.push(`Nose temp setpoint is ${noseSetPoint}°, expected ${requiredTemps.nose}°`);
                }
            }
            
            // check tail setpoint
            if (requiredTemps.tail !== null && !tailActive) {
                setpointIssue = true;
                issues.push(`Tail reefer is not running, expected ${requiredTemps.tail}°`);
            } else if (requiredTemps.tail !== null && tailSetPoint === undefined) {
                setpointIssue = true;
                issues.push(`Tail temp setpoint was not found, expected ${requiredTemps.tail}°`);
            } else if (requiredTemps.tail !== null && tailSetPoint !== requiredTemps.tail) {
                setpointIssue = true;
                issues.push(`Tail temp setpoint is ${tailSetPoint}°, expected ${requiredTemps.tail}°`);
            }

            // Check trailer discharge air temp if setpoints are good and trailer loading has started and trailer has been in door for at least 60 minutes
            if(!setpointIssue && loadData.batchesLoaded > 0 && trailerData.stationaryMinutes >= 60){
                let maxNose = null;
                let maxTail = null;
                switch(route.routeGroup) {
                    case "PDIFRZ":
                        maxNose = 0;
                        maxTail = null;
                        break;
                    case "MIX":
                        maxNose = 0;
                        maxTail = 40;
                        break;
                    case "PDIFRSH":
                        maxNose = 40;
                        maxTail = null;
                        break;
                }
                const noseDischarge = trailerData?.zones?.nose?.dischargeAir;
                const tailDischarge = trailerData?.zones?.tail?.dischargeAir;
                if (maxNose !== null && noseDischarge !== undefined && noseDischarge > maxNose) {
                    issues.push(`Nose discharge air temp is ${noseDischarge}°, expected <= ${maxNose}°`);
                }
                if (maxTail !== null && tailDischarge !== undefined && tailDischarge > maxTail) {
                    issues.push(`Tail discharge air temp is ${tailDischarge}°, expected <= ${maxTail}°`);
                }
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
                    position: trailerData.position,
                    stationary: trailerData.stationaryMinutes
                });
            }
        }

        // Add to door usage map for general notifications (repeated use of same door)
        if(route.door){
            const routeTime = Date.parse(route.plannedDispatchDate);
            if (!doorUsage[route.door]) {
                doorUsage[route.door] = [];
            }
            doorUsage[route.door].push({ route: route.route, shipment: route.shipment || '', time: routeTime });
            if (doorUsage[route.door].length > 1) {
                repeatedDoors.add(route.door);
            }
        }

    });

    // ------- Notify of common stores staged too close together (within +-4 doors) (ex. ANKENY1 on 2 different routes is staged at B15 and B17) -------
    if (appSettings.prospero_commonStoresPriximity) {
        
        // Store locations set for quick lookup
        const storeNames = new Set(stopLocations.Stores || []);

        const routeSequences = routes.filter(r => r.door).map(r => ({
            route: r.route,
            door: r.door,
            doorLetter: r.door[0],
            doorNum: parseInt(r.door.slice(1)),
            sequence: r.deliverySequence.split('|').map(s => s.trim()).filter(s => s !== 'PDI'),
            plannedDispatchDate: r.plannedDispatchDate
        }));

        for (let i = 0; i < routeSequences.length; i++) {
            for (let j = i + 1; j < routeSequences.length; j++) {
                const r1 = routeSequences[i];
                const r2 = routeSequences[j];
                
                if (r1.doorLetter === r2.doorLetter && 
                    Math.abs(r1.doorNum - r2.doorNum) <= 3 && 
                    Math.abs(Date.parse(r1.plannedDispatchDate) - Date.parse(r2.plannedDispatchDate)) <= 5 * 60 * 60 * 1000) {
                    
                    // Get all stops that match between both routes
                    const commonStops = r1.sequence.filter(s => r2.sequence.includes(s));
                    
                    if (commonStops.length > 0) {
                        // Only keep stops that are in the store names set
                        const commonStores = commonStops.filter(stop => storeNames.has(stop));

                        // send the notification if there are actual store conflicts
                        if (commonStores.length > 0) {
                            generalNotifications.push(`[${r1.route} at ${r1.door}] and [${r2.route} at ${r2.door}] both stop at: ${commonStores.join(', ')}. Pickers will mix batches and they will be harder to load.`);
                        }
                    }
                }
            }
        }
    }

    // ---- Notify of doors that are booked multiple times (ex. B12 is used for 3 different routes) ----
    if(appSettings.prospero_repeatedDoors){
        repeatedDoors.forEach(door => {
            const entries = doorUsage[door].slice().sort((a, b) => a.time - b.time);
            const routeEntries = entries.map(entry => ({
                route: entry.route,
                shipment: entry.shipment || '',
                time: entry.time,
                formattedTime: formatDispatchTime(entry.time)
            }));
            const bookingLabel = entries.length === 2 ? 'double booked'
                : entries.length === 3 ? 'triple booked'
                : entries.length === 4 ? 'quadruple booked'
                : `${entries.length}x booked`;

            generalNotifications.push({
                type: 'doorRepeat',
                door,
                count: entries.length,
                header: `${door} is ${bookingLabel}`,
                routeEntries
            });
        });
    }

    // Clean up dismissed notifications that are no longer relevant (user changed a door that was double booked)
    currentDismissedNotifications = currentDismissedNotifications.filter(notif => {
        if (notif?.type === 'doorRepeat' && Array.isArray(notif.routeEntries)) {
            const currentRoutesForDoor = doorUsage[notif.door] ? doorUsage[notif.door].map(e => e.route) : [];
            return notif.routeEntries.every(entry => currentRoutesForDoor.includes(entry.route));
        }

        const text = getNotificationText(notif);
        if (!text.startsWith('Door ')) return true; // keep non-door notifications
        const parts = text.split(' is repeated: ');
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

    // Check snoozed notifications and move any expired ones back to general notifications
    const currentTime = Date.now();
    currentSnoozedNotifications = currentSnoozedNotifications.filter(snoozed => {
        if (currentTime > snoozed.snoozeUntil) {
            generalNotifications.unshift(snoozed.notification);
            return false; // remove from snoozed
        }
        return true;
    });
    // Save updated snoozed
    chrome.storage.local.set({ snoozedNotifications: currentSnoozedNotifications });

    currentNewNotifications = generalNotifications.filter(n => !currentDismissedNotifications.some(entry => getNotificationText(entry) === getNotificationText(n)));
    currentTemperatureMessages = tempNotifications;

    renderDock({
        newNotifications: currentNewNotifications,
        dismissedNotifications: currentDismissedNotifications,
        snoozedNotifications: currentSnoozedNotifications,
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

        appSettings.devMode ? console.log("Received listing data:", prosperoCache.routes) : null;

        // Process routes
        await processRoutes(prosperoCache.routes, appSettings);
    }
}

async function init() {
    // load settings
    const { appSettings } = await chrome.storage.local.get('appSettings');
    currentAppSettings = appSettings;
    if (!(appSettings && appSettings.scriptsEnabled)) {
        console.log("Clerk Extension is toggled off.");
        return;
    }
    console.log("Clerk Extension is enabled.", appSettings.devMode ? appSettings : "Live mode");

    // load stop locations
    await window.getStopLocations();

    // load dismissed notifications
    const { dismissedNotifications: storedDismissed } = await chrome.storage.local.get('dismissedNotifications');
    currentDismissedNotifications = normalizeDismissedNotifications(storedDismissed);
    chrome.storage.local.set({ dismissedNotifications: currentDismissedNotifications });

    // load snoozed notifications
    const { snoozedNotifications: storedSnoozed } = await chrome.storage.local.get('snoozedNotifications');
    currentSnoozedNotifications = storedSnoozed || [];
    chrome.storage.local.set({ snoozedNotifications: currentSnoozedNotifications });

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
