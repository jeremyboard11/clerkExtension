document.addEventListener('DOMContentLoaded', () => {
    const views = document.querySelectorAll('.view');
    const menuRows = document.querySelectorAll('.menu-row');
    const backButtons = document.querySelectorAll('.back-btn');

    // 1. Standard Toggles Configuration
    const toggles = {
        masterToggle: 'scriptsEnabled',
        trackingToggle: 'prospero_tracking',
        lockdownToggle: 'prospero_lockdown',
        closeRouteToggle: 'prospero_closeRoute',
        loadAssignToggle: 'prospero_loadAssign',
        batchCountToggle: 'wms_batchCount',
        devModeToggle: 'devMode'
    };

    // 2. Rules Input Configuration (mapping ID to the nested object path)
    const ruleInputs = [
        { id: 'mix_nose', group: 'mix', key: 'nose' },
        { id: 'mix_tail', group: 'mix', key: 'tail' },
        { id: 'pdifrsh_nose', group: 'pdifrsh', key: 'nose' },
        { id: 'pdifrsh_tail', group: 'pdifrsh', key: 'tail' },
        { id: 'pdifrz_nose', group: 'pdifrz', key: 'nose' },
        { id: 'pdifrz_tail', group: 'pdifrz', key: 'tail' }
    ];

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

    // Default temp rules
    const DEFAULT_RULES = {
        mix: { nose: -18, tail: 35 },
        pdifrsh: { nose: 35, tail: null },
        pdifrz: { nose: -18, tail: null }
    };

    function loadSettings() {
        chrome.storage.local.get('appSettings', (res) => {
            const settings = res['appSettings'] || {};
            
            // Load Toggles - Default to FALSE if missing
            Object.keys(toggles).forEach(id => {
                const storageKey = toggles[id];
                const element = document.getElementById(id);
                if (element) {
                    element.checked = settings[storageKey] ?? false;
                }
            });

            // Load Rules - Ensure storedRules doesn't override with nulls if empty
            const storedRules = settings.tempRules || {};
            const rules = {
                mix: { ...DEFAULT_RULES.mix, ...storedRules.mix },
                pdifrsh: { ...DEFAULT_RULES.pdifrsh, ...storedRules.pdifrsh },
                pdifrz: { ...DEFAULT_RULES.pdifrz, ...storedRules.pdifrz }
            };

            ruleInputs.forEach(inputCfg => {
                const element = document.getElementById(inputCfg.id);
                if (element) {
                    const val = rules[inputCfg.group][inputCfg.key];
                    // Show empty string if null/undefined, otherwise show the number (even if 0)
                    element.value = (val === null || val === undefined) ? '' : val;
                }
            });
        });
    }

    function saveSettings() {
        // 1. Build the base appSettings object with toggles
        const allSettings = {};
        Object.keys(toggles).forEach(id => {
            const storageKey = toggles[id];
            allSettings[storageKey] = document.getElementById(id).checked;
        });

        // 2. Build the tempRules object
        const tempRules = {
            mix: {},
            pdifrsh: {},
            pdifrz: {}
        };

        ruleInputs.forEach(inputCfg => {
            const element = document.getElementById(inputCfg.id);
            // Convert empty string to null, otherwise parse as number
            const val = element.value === '' ? null : parseFloat(element.value);
            tempRules[inputCfg.group][inputCfg.key] = val;
        });

        // 3. Nest tempRules inside allSettings
        allSettings.tempRules = tempRules;

        // 4. Save the single object
        chrome.storage.local.set({ appSettings: allSettings }, () => {
            console.log('All settings (including nested rules) saved.');
        });
    }

    // Initialize state on load
    loadSettings();

    // Event Listeners for Toggles
    Object.keys(toggles).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', saveSettings);
        }
    });

    // Event Listeners for Rule Inputs (save on blur or change)
    ruleInputs.forEach(inputCfg => {
        const element = document.getElementById(inputCfg.id);
        if (element) {
            element.addEventListener('change', saveSettings);
        }
    });

    window.addEventListener('beforeunload', saveSettings);
});
