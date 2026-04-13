document.addEventListener('DOMContentLoaded', () => {
    const views = document.querySelectorAll('.view');
    const menuRows = document.querySelectorAll('.menu-row');
    const backButtons = document.querySelectorAll('.back-btn');

    // List of all toggles to track
    const toggles = {
        masterToggle: 'scriptsEnabled',
        trackingToggle: 'prospero_tracking',
        lockdownToggle: 'prospero_lockdown',
        closeRouteToggle: 'prospero_closeRoute',
        loadAssignToggle: 'prospero_loadAssign',
        batchCountToggle: 'wms_batchCount'
    };

    // --- NAVIGATION ---
    function showView(viewId) {
        views.forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    }

    menuRows.forEach(row => {
        row.addEventListener('click', () => showView(row.getAttribute('data-target')));
    });

    backButtons.forEach(btn => {
        btn.addEventListener('click', () => showView('mainView'));
    });

    // --- STORAGE & STATES ---
    // Load all saved states
    chrome.storage.sync.get(Object.values(toggles), (res) => {
        Object.keys(toggles).forEach(id => {
            const storageKey = toggles[id];
            const element = document.getElementById(id);
            // Default to true if the setting doesn't exist yet
            element.checked = res[storageKey] !== false;
        });
    });

    // Save changes when any toggle is clicked
    Object.keys(toggles).forEach(id => {
        const element = document.getElementById(id);
        element.addEventListener('change', () => {
            const storageKey = toggles[id];
            chrome.storage.sync.set({ [storageKey]: element.checked });
            console.log(`${storageKey} set to ${element.checked}`);
        });
    });
});