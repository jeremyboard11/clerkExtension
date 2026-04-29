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
            .then(response => {
                console.log("(Dev Mode): Loaded mock route group data.");
                window.dispatchEvent(new CustomEvent('PROSPERO_DATA_READY', {
                    detail: { type: 'routeGroups', response }
                }));
            })
            .catch(err => {
                console.error("Failed to load mock route group data.", err);
            });
        // trailers
        fetch(document.currentScript.dataset.devProsperoTrailersUrl)
            .then(res => res.json())
            .then(response => {
                console.log("(Dev Mode): Loaded mock trailer data.");
                window.dispatchEvent(new CustomEvent('PROSPERO_DATA_READY', {
                    detail: { type: 'trailer', response }
                }));
            })
            .catch(err => {
                console.error("Failed to load mock trailer data.", err);
            });
        // routes
        fetch(document.currentScript.dataset.devProsperoDataUrl)
            .then(res => res.json())
            .then(response => {
                console.log("(Dev Mode): Loaded mock route data.");
                window.dispatchEvent(new CustomEvent('PROSPERO_DATA_READY', {
                    detail: { type: 'listing', response }
                }));
            })
            .catch(err => {
                console.error("Failed to load mock route data.", err);
            });
    }else{
       // ------------- Live Mode Context Setup ----------------
	   
		// temp local trailers
		fetch(document.currentScript.dataset.devProsperoTrailersUrl)
			.then(res => res.json())
			.then(data => {
				console.log("(Dev Mode): Loaded mock trailer data.");
				window.dispatchEvent(new CustomEvent('PROSPERO_DATA_READY', {
					detail: { type: 'trailer', data }
				}));
			})
			.catch(err => {
				console.error("Failed to load mock trailer data.", err);
			});
		
	   
	   
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            // Store the URL on the XHR object for access in the 'load' event
            this._url = url;
            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function() {
            this.addEventListener('load', function() {
				
				// intercept trailer data
				if (this._url && this._url.includes('trailer')) {
					try {
						// Attempt to parse JSON for a cleaner log, otherwise log raw text
						const response = JSON.parse(this.responseText);

						window.dispatchEvent(new CustomEvent('PROSPERO_DATA_READY', {
							detail: { type: 'trailer', response }
						}));

					} catch (e) {
						//error
						console.log('live error (Raw):', this.responseText);
					}
				}

				// intercept route data
                if (this._url && this._url.includes('listing')) {
                    try {
                        // Attempt to parse JSON for a cleaner log, otherwise log raw text
                        const response = JSON.parse(this.responseText);

                        window.dispatchEvent(new CustomEvent('PROSPERO_DATA_READY', {
                            detail: { type: 'listing', response }
                        }));

                    } catch (e) {
                        //error
                        console.log('live error (Raw):', this.responseText);
                    }
                }
				
				// intercept route group data
                if (this._url && this._url.includes('controlName=DispatchBoardTripsFilter&siteId=1080')) {
                    try {
                        // Attempt to parse JSON for a cleaner log, otherwise log raw text
                        const response = JSON.parse(this.responseText);

                        window.dispatchEvent(new CustomEvent('PROSPERO_DATA_READY', {
                            detail: { type: 'routeGroups', response }
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