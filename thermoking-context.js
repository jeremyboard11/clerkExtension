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
            .then(response => {
                console.log("(Dev Mode): Loaded mock thermoking data.");
                window.dispatchEvent(new CustomEvent('THERMOKING_DATA_READY', {
                    detail: { type: 'trailers', response }
                }));
            })
            .catch(err => {
                console.error("Failed to load mock thermoking data.", err);
            });
    }else{
        // ------------- Live Mode Context Setup ----------------
	const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            // Store the URL on the XHR object for access in the 'load' event
            this._url = url;
            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function() {
            this.addEventListener('load', function() {
                // Check if the URL includes 'getData'
                if (this._url && this._url.includes('getData')) {
                    try {
                        // Attempt to parse JSON for a cleaner log, otherwise log raw text
                        const response = JSON.parse(this.responseText);
						
						const nowTs = new Date().toLocaleTimeString();
						console.log("(DEV): Updating local thermoking data at: "+nowTs, response);
						
                        window.dispatchEvent(new CustomEvent('THERMOKING_DATA_READY', {
                            detail: { type: 'trailers', response }
                        }));

                    } catch (e) {
                        //error
                        console.log('live error (Raw):', this.responseText);
                    }
                }
            });

            return originalSend.apply(this, arguments);
        };
    }
})();