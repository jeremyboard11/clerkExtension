(function(){
    const appSettings = JSON.parse(document.currentScript.dataset.appSettings);
    if (!(appSettings && appSettings.scriptsEnabled)) {
        console.log("loaded settings");
        return;
    }

    if (appSettings.devMode && document.currentScript.dataset.devProsperoDataUrl) {
        // ------------- Dev Mode Context Setup ----------------
        // route groups
        fetch(document.currentScript.dataset.devProsperoRouteGroupsUrl)
            .then(res => res.json())
            .then(data => {
                console.log("(Dev Mode): Loaded mock route group data.");
                window.dispatchEvent(new CustomEvent('PROSPERO_DATA_READY', {
                    detail: { type: 'routeGroups', data }
                }));
            })
            .catch(err => {
                console.error("Failed to load mock route group data.", err);
            });
        // trailers
        fetch(document.currentScript.dataset.devProsperoTrailersUrl)
            .then(res => res.json())
            .then(data => {
                console.log("(Dev Mode): Loaded mock trailer data.");
                window.dispatchEvent(new CustomEvent('PROSPERO_DATA_READY', {
                    detail: { type: 'trailers', data }
                }));
            })
            .catch(err => {
                console.error("Failed to load mock trailer data.", err);
            });
        // routes
        fetch(document.currentScript.dataset.devProsperoDataUrl)
            .then(res => res.json())
            .then(data => {
                console.log("(Dev Mode): Loaded mock route data.");
                window.dispatchEvent(new CustomEvent('PROSPERO_DATA_READY', {
                    detail: { type: 'listing', data }
                }));
            })
            .catch(err => {
                console.error("Failed to load mock route data.", err);
            });
    }else{
        // ------------- Live Mode Context Setup ----------------
    }
})();