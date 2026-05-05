function getLocateHeaders() {
    const anchors = Array.from(document.querySelectorAll('a'));
    const targetAnchor = anchors.find(a =>
        a.textContent.trim().toLowerCase().includes("trailer #")
    );
    if (!targetAnchor) {
        console.warn("No <a> containing 'trailer #' found.");
        return null;
    }

    let current = targetAnchor;
    let headerRow = null;
    while (current) {
        if (
            current.tagName &&
            current.tagName.toLowerCase() === 'tr' &&
            current.classList.contains('datagridheaderitem')
        ) {
            headerRow = current;
            break;
        }
        current = current.parentElement;
    }

    if (!headerRow) {
        console.warn("No parent <tr> with class 'datagridheaderitem' found. (didnt find header row)");
        return null;
    }

    const locateHeaders = {};
    const cells = Array.from(headerRow.children);
    cells.forEach((cell, index) => {
        let text = cell.textContent.trim();
        if (!text) return;
        const key = text.toLowerCase().replace(/\s+/g, '_');
        locateHeaders[key] = index;
    });
    
    console.log("Located headers:", locateHeaders);
    return locateHeaders;
}

function processTable() {
    const output = [];
    const headers = getLocateHeaders();
    if (!headers) {
        alert("Could not determine header columns.");
        return;
    }

    const table = document.getElementById("dgTrailerInfo");
    if (!table) {
        alert("Table 'dgTrailerInfo' not found.");
        return;
    }

    // rename headers
    const headerMap = {
        "trailer": headers["trailer_#"],
        "pad": headers["current_pad"],
        "load": headers["load#"],
        "commodity": headers["commodity"],
        "status": headers["status"],
        "facility": headers["facility"],
    };

    const yardData = Array.from(table.querySelectorAll("tr"))
        .map(row => {
            const cells = row.querySelectorAll("td");
            
            // Build the individual trailer object
            return Object.entries(headerMap).reduce((acc, [key, index]) => {
                acc[key] = cells[index]?.innerText.trim() || "";
                return acc;
            }, {});
        })
        .filter(row => row.facility.toUpperCase() === "PDI")
        .reduce((acc, item) => {
            // Key the entire object by the trailer number
            if (item.trailer) {
                acc[item.trailer] = item;
            }
            return acc;
        }, {});
        
        // Save to chrome local storage
        chrome.storage.local.set({
            yardTrailers: yardData,
            yardLastUpdate: Date.now()
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving yard data:", chrome.runtime.lastError);
            } else {
            console.log("Local yard cache updated at " + new Date().toLocaleTimeString());
        }
    });
}

processTable();
