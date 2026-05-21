export function renderDock({ 
    newNotifications = [], 
    dismissedNotifications = [], 
    snoozedNotifications = [], 
    temperatureMessages = [],
    currentAppSettings = {}
} = {}) {
    let host = document.getElementById('temp-dock-host');
    let shadow;

    // --- INITIAL BOOTSTRAP (Runs once) ---
    if (!host) {
        host = document.createElement('div');
        host.id = 'temp-dock-host';
        document.documentElement.appendChild(host);
        shadow = host.attachShadow({ mode: 'open' });

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('floating-dock.css');
        shadow.appendChild(link);

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

            const maxLeft = Math.max(0, window.innerWidth - dock.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - dock.offsetHeight);
            const nextLeft = Math.min(maxLeft, Math.max(0, e.clientX - ox));
            const nextTop = Math.min(maxTop, Math.max(0, e.clientY - oy));

            dock.style.left = nextLeft + 'px';
            dock.style.top = nextTop + 'px';
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
    const notifBadge = shadow.querySelector('#count-notif');
    notifBadge.innerText = newNotifications.length;
    notifBadge.style.display = newNotifications.length ? 'inline-flex' : 'none';
    const tempBadge = shadow.querySelector('#count-temp');
    tempBadge.innerText = temperatureMessages.length;
    tempBadge.style.display = temperatureMessages.length ? 'inline-flex' : 'none';

    // 2. Update Notification List
    const notifPanel = shadow.querySelector('#panel-notif');
    notifPanel.innerHTML = `
        <div class="section">
            <h4>New Notifications</h4>
            ${newNotifications.map(n => {
                const text = getNotificationText(n);
                // -------- Door repeat notifications -----------
                if (n?.type === 'doorRepeat') {
                    return `
                        <div class="item-card door-repeat-card" data-type="new">
                            <div class="notif-txt repeatDoor">${text}</div>
                            <div class="repeat-list">
                                ${n.routeEntries.map((entry, idx) => `
                                    <div class="repeat-item">
                                        <div class="repeat-route">
                                            <span class="repeat-route-id">${entry.route}${entry.shipment ? '>' + entry.shipment : ''}</span>
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
                // ---------- Snoozable notifications ----------
                if (n?.type === 'snoozable') {
                    return `
                        <div class="item-card" data-type="new">
                            <span class="notif-txt">${text}</span>
                            <button class="snooze-btn">Snooze</button>
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
            <h4>Snoozed Notifications</h4>
            ${snoozedNotifications.map(s => {
                const text = getNotificationText(s.notification);
                const snoozeTime = new Date(s.snoozeAt).toLocaleString();
                return `
                    <div class="item-card" data-type="snoozed">
                        <span class="notif-txt">${text}</span>
                        <button class="dismiss-btn">Dismiss</button>
                        <div class="footer-info">Snoozed at: ${snoozeTime}</div>
                    </div>
                `;
            }).join('') || '<div class="item-card">No snoozed notifications</div>'}
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
        btn.onclick = (e) => {
            const card = e.target.closest('.item-card');
            const text = card.querySelector('.notif-txt').textContent.replace('• ', '').trim();
            const type = card.dataset.type;
            
            if (type === 'new') {
                const index = newNotifications.findIndex(entry => getNotificationText(entry) === text);
                if (index !== -1) {
                    newNotifications.splice(index, 1);
                }
                dismissedNotifications.unshift({ text, dismissedAt: Date.now() });
            } else if (type === 'snoozed') {
                const index = snoozedNotifications.findIndex(entry => getNotificationText(entry.notification) === text);
                if (index !== -1) {
                    snoozedNotifications.splice(index, 1);
                }
                dismissedNotifications.unshift({ text, dismissedAt: Date.now() });
                chrome.storage.local.set({ snoozedNotifications: snoozedNotifications });
            } else {
                // For dismissed cards that might have a dismiss button (none currently, but for robustness)
                const index = dismissedNotifications.findIndex(entry => getNotificationText(entry) === text);
                if (index !== -1) {
                    dismissedNotifications.splice(index, 1);
                }
            }
            chrome.storage.local.set({ dismissedNotifications: dismissedNotifications });
            renderDock({
                newNotifications,
                dismissedNotifications,
                snoozedNotifications,
                temperatureMessages,
                currentAppSettings
            });
        };
    });

    // Add snooze event listeners
    notifPanel.querySelectorAll('.snooze-btn').forEach(btn => {
        btn.onclick = (e) => {
            const card = e.target.closest('.item-card');
            const text = card.querySelector('.notif-txt').textContent.replace('• ', '').trim();
            const index = newNotifications.findIndex(entry => getNotificationText(entry) === text);
            if (index !== -1) {
                const notification = newNotifications.splice(index, 1)[0];
                const snoozeDuration = (currentAppSettings.prospero_notificationSnoozeMinutes || 5) * 60 * 1000;
                snoozedNotifications.push({
                    notification,
                    snoozeAt: Date.now(),
                    snoozeUntil: Date.now() + snoozeDuration
                });
                chrome.storage.local.set({ snoozedNotifications: snoozedNotifications });
                renderDock({
                    newNotifications,
                    dismissedNotifications,
                    snoozedNotifications,
                    temperatureMessages,
                    currentAppSettings
                });
            }
        };
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
                <div>Stationary: ${item.stationary + ' minutes' || 'N/A'}</div>
            </div>
        </div>
    `).join('') || '<div class="item-card">No temperature issues</div>';
}

function getNotificationText(notification) {
    if (typeof notification === 'string') return notification;
    if (!notification) return '';
    if (typeof notification.text === 'string' && notification.text) return notification.text;
    if (typeof notification.header === 'string' && notification.header) return notification.header;
    if (notification.type === 'doorRepeat' && notification.header) return notification.header;
    return '';
}
