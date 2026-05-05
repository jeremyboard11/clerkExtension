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
            :host { --bg: #222; --accent: #DDD; --text: #999; --err: #ff5c4d; --notif: #ffcc00; }
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
            .item-card[data-type="dismissed"] { background-color: #2b2b2b; border-color: #555; opacity: 0.85; align-items: center; }
            .item-card[data-type="dismissed"] .notif-txt { color: #999; font-style: normal; flex-grow: 1; text-align:center; }
            .item-card[data-type="dismissed"] .dismiss-btn { background: #444; }
            .door-repeat-card { flex-direction: column; align-items: stretch; }
            .repeat-list { display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
            .repeat-item { display: flex; flex-direction: column; gap: 4px; padding: 6px 0; border-top: 1px solid #444; }
            .repeat-item:first-child { border-top: none; }
            .repeat-route { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: baseline; }
            .repeat-route-id { font-size: 15px; font-weight: 700; color: #FFF; }
            .repeat-route-time { font-size: 13px; color: #ccc; }
            .repeat-separator { text-align: center; color: #888; font-size: 14px; }
            .repeat-gap { text-align: center; font-size: 13px; color: #ccc; font-weight: 600; }
            .item-card.caughtup { font-style: italic; text-align: center; font-size: 16px; border: none; background: none; margin: 40px 0;}
            .temp-card { display: block; }
            .primary-info { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: var(--accent); margin-bottom: 8px; }
            .secondary-info { font-size: 14px; color: #ccc; margin-bottom: 8px; }
            .temp-issues { margin: 8px 0; }
            .temp-issues .issue-item { margin: 4px 0; font-size: 13px; color: var(--notif); font-weight: bold; }
            .temp-issues .issue-item::before { content: '⚠ '; }
            .footer-info { font-size: 11px; color: #aaa; margin-top: 8px; }
            .footer-info div { margin: 2px 0; }
            .err-txt { color: var(--err); font-size: 11px; margin-top: 3px; padding-left: 5px; }
            .notif-txt { color: var(--notif); flex: 1; }
            .notif-txt.repeatDoor { font-size: 20px; }
            .section { margin-bottom: 10px; }
            .section h4 { margin: 0 0 5px 0; color: var(--accent); font-size: 14px; }
            .dismiss-btn { margin-left: 4px; background: none; color: #DDD; border: none; padding: 12px; cursor: pointer; font-size: 14px; }
            .dismiss-btn:hover { background: rgba(255, 255, 255, 0.1); }
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
    const notifBadge = shadow.querySelector('#count-notif');
    notifBadge.innerText = newNotifications.length;
    notifBadge.style.display = newNotifications.length ? 'inline-flex' : 'none';
    shadow.querySelector('#count-temp').innerText = temperatureMessages.length;

    // 2. Update Notification List
    const notifPanel = shadow.querySelector('#panel-notif');
    notifPanel.innerHTML = `
        <div class="section">
            <h4>New Notifications</h4>
            ${newNotifications.map(n => {
                const text = getNotificationText(n);
                if (n?.type === 'doorRepeat') {
                    return `
                        <div class="item-card door-repeat-card" data-type="new">
                            <div class="notif-txt repeatDoor">${text}</div>
                            <div class="repeat-list">
                                ${n.routeEntries.map((entry, idx) => `
                                    <div class="repeat-item">
                                        <div class="repeat-route">
                                            <span class="repeat-route-id">${entry.route}</span>
                                            <span class="repeat-route-time">${entry.formattedTime}</span>
                                        </div>
                                        ${idx < n.routeEntries.length - 1 ? `
                                            <div class="repeat-separator">•</div>
                                            <div class="repeat-gap">${Math.round(((n.routeEntries[idx + 1].time - entry.time) / 3600000) * 2) / 2}h</div>
                                            <div class="repeat-separator">•</div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                            <button class="dismiss-btn">Dismiss</button>
                        </div>
                    `;
                }
                return `
                    <div class="item-card" data-type="new">
                        <span class="notif-txt">${text}</span>
                        <button class="dismiss-btn">Dismiss</button>
                    </div>
                `;
            }).join('') || '<div class="item-card caughtup">No new notifications</div>'}
        </div>
        <div class="section">
            <h4>Dismissed Notifications</h4>
            ${dismissedNotifications.map(n => `
                <div class="item-card" data-type="dismissed">
                    <span class="notif-txt">${getNotificationText(n)}</span>
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
                const index = currentNewNotifications.findIndex(entry => getNotificationText(entry) === text);
                if (index !== -1) {
                    currentNewNotifications.splice(index, 1);
                }
                currentDismissedNotifications.unshift({ text, dismissedAt: Date.now() });
            } else {
                currentDismissedNotifications = currentDismissedNotifications.filter(entry => getNotificationText(entry) !== text);
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
            <div class="primary-info">
                <span>Trailer: ${item.trailer}</span>
                <span>Door: ${item.door}</span>
            </div>
            <div class="secondary-info">Route: ${item.route} | Route Group: ${item.routeGroup}</div>
            <div class="temp-issues">
                ${((item.errors || []).length ? (item.errors || []).map(err => `<div class="issue-item">${err}</div>`).join('') : '<div class="issue-item">No issues found.</div>')}
            </div>
            <div class="footer-info">
                <div>Last Updated: ${item.updated ? new Date(item.updated).toLocaleString() : 'N/A'}</div>
                <div>Location: ${item.position || 'N/A'}</div>
            </div>
        </div>
    `).join('') || '<div class="item-card">No temperature issues</div>';
};

// ------------ Data Cache and State Management ------------

let currentNewNotifications = [];
let currentDismissedNotifications = [];
let currentTemperatureMessages = [];

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
        
        // If no thermoking data for the trailer, add a general notification
        if(!trailerData){
            generalNotifications.push(`No trailer temp data available for trailer ${route.trailer} on route ${route.route} (door ${route.door}).`);
        }
        
        // -------- Check trailer temperature ---------
        if(trailerData && trailerInDoor){
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

        // Add to door usage map for general notifications (repeated use of same door)
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
        const routeEntries = entries.map(entry => ({
            route: entry.route,
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

    currentNewNotifications = generalNotifications.filter(n => !currentDismissedNotifications.some(entry => getNotificationText(entry) === getNotificationText(n)));
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

        appSettings.devMode ? console.log("Received listing data:", prosperoCache.routes) : null;

        // Process routes
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
    console.log("Clerk Extension is enabled.", appSettings.devMode ? appSettings : "Live mode");

    // load dismissed notifications
    const { dismissedNotifications: storedDismissed } = await chrome.storage.local.get('dismissedNotifications');
    currentDismissedNotifications = normalizeDismissedNotifications(storedDismissed);
    chrome.storage.local.set({ dismissedNotifications: currentDismissedNotifications });

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
