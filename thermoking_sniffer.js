/**
 * CLERK EXTENSION - ThermoKing Network Sniffer
 */
(function () {
    const IS_DEVELOPMENT = true;

    function snifferLog(message) {
        console.log(`Clerk Extension (TK Sniffer): ${message}`);
    }

    const me = document.querySelector('script[data-sample-url]');
    const sampleDataUrl = me ? me.dataset.sampleUrl : null;

    // send trailer data to thermoking.js
    function dispatchData(data) {
        window.dispatchEvent(new CustomEvent('THERMOKING_DATA_READY', {
            detail: data
        }));
    }

    if (IS_DEVELOPMENT && sampleDataUrl) {
        setTimeout(() => {
            fetch(sampleDataUrl)
                .then(res => res.json())
                .then(json => {
                    snifferLog("Dev Mode: Mocking 'getData' response");
                    dispatchData(json.aaData); // Extracting aaData immediately
                });
        }, 1000);
    } else {
        // may need to change nesting level for reading 'getData' xhr response
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function () {
            this.addEventListener('load', function () {
                if (this._url && this._url.includes('getData')) {
                    try {
                        const json = JSON.parse(this.responseText);
                        if (json.aaData) {
                            snifferLog("Intercepted ThermoKing Data");
                            dispatchData(json.aaData);
                        }
                    } catch (e) { }
                }
            });
            return originalSend.apply(this, arguments);
        };
    }
})();