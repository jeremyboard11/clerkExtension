(function(){
    const appSettings = JSON.parse(document.currentScript.dataset.appSettings);
    if (!(appSettings && appSettings.scriptsEnabled)) {
        console.log("loaded settings");
        return;
    }

    if (appSettings.devMode && document.currentScript.dataset.devThermokingDataUrl) {
        // ------------- Dev Mode Context Setup ----------------
        // thermoking data
        fetch(document.currentScript.dataset.devThermokingDataUrl)
            .then(res => res.json())
            .then(data => {
                console.log("(Dev Mode): Loaded mock thermoking data.");
                window.dispatchEvent(new CustomEvent('THERMOKING_DATA_READY', {
                    detail: { type: 'trailers', data }
                }));
            })
            .catch(err => {
                console.error("Failed to load mock thermoking data.", err);
            });
    }else{
        // ------------- Live Mode Context Setup ----------------
    }
})();