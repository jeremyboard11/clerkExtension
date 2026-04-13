/**
 * CLERK EXTENSION - Prospero Network Sniffer
 */
(function () {
    const IS_DEVELOPMENT = false;

    // Define a local logger because this script cannot see prospero.js functions
    function snifferLog(message) {
        console.log(`Clerk Extension (Sniffer): ${message}`);
    }

    const me = document.querySelector('script[data-sample-url]');
    const prosperoDevDataUrl = me ? me.dataset.sampleUrl : null;

    function dispatchData(type, data) {
        window.dispatchEvent(new CustomEvent('PROSPERO_DATA_READY', {
            detail: { type, data }
        }));
    }

    if (IS_DEVELOPMENT && prosperoDevDataUrl) {
        setTimeout(() => {
            fetch(prosperoDevDataUrl)
                .then(res => res.json())
                .then(data => {
                    snifferLog("Dev Mode: Mocking 'listing' data"); // Updated here
                    dispatchData('listing', data);
                });

            const mockTrailers = [
                { "trailerId": 1598, "trailerCode": "69696" },
                { "trailerId": 2056, "trailerCode": "22757" },
                { "trailerId": 2101, "trailerCode": "122022" },
                { "trailerId": 2102, "trailerCode": "1053" },
                { "trailerId": 2103, "trailerCode": "16616" },
                { "trailerId": 2104, "trailerCode": "1856" }
            ];
            snifferLog("Dev Mode: Mocking 'trailers' data"); // Updated here
            dispatchData('trailers', mockTrailers);
        }, 800);

    } else {
        // ------------ Live Mode XHR Interception ----------------
        
	const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url; // Store URL for checking in 'load' event
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
	// listing
            if (this._url && this._url.includes('listing')) {
                try {
                    const data = JSON.parse(this.responseText);
			// json response
			snifferLog("Intercepted listing");
                        dispatchData('listing', data);
                } catch (e) {
                    console.error("Couldnt get listing");
                }
            }
	// trailers
		if (this._url && this._url.includes('trailers')) {
                try {
                    const data = JSON.parse(this.responseText);
			// json response
			snifferLog("Intercepted trailers");
                        dispatchData('trailers', data);
                } catch (e) {
                    console.error("Couldnt get trailers");
                }
            }
        });
        return originalSend.apply(this, arguments);
    };


	// -------------------------------------------------------
    }
})();