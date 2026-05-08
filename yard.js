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
        console.warn("No parent <tr> with class 'datagridheaderitem' found.");
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
    
    return locateHeaders;
}

function processTable() {
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
            return Object.entries(headerMap).reduce((acc, [key, index]) => {
                acc[key] = cells[index]?.innerText.trim() || "";
                return acc;
            }, {});
        })
        .filter(row => row.facility && row.facility.toUpperCase() === "PDI")
        .reduce((acc, item) => {
            if (item.trailer) {
                acc[item.trailer] = item;
            }
            return acc;
        }, {});
        
    chrome.storage.local.set({
        yardTrailers: yardData,
        yardLastUpdate: Date.now()
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving yard data:", chrome.runtime.lastError);
        } else {
            console.log("Local yard cache updated at " + new Date().toLocaleTimeString());
            // Optional: visual feedback that it worked
            const btn = document.getElementById('gemini-update-btn');
            if(btn) {
                const originalText = btn.innerText;
                btn.innerText = "Updated!";
                btn.style.backgroundColor = "#28a745";
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.style.backgroundColor = "#007bff";
                }, 2000);
            }
        }
    });
}

/**
 * Creates and injects the Update button into the DOM
 */
function createUpdateButton() {
    // Prevent duplicate buttons if script runs twice
    if (document.getElementById('gemini-update-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'gemini-update-btn';
    btn.innerText = 'Update Yard Data';
    
    // Styling to keep it in the top right
    Object.assign(btn.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: '9999',
        padding: '8px 12px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        fontFamily: 'sans-serif',
        fontSize: '12px'
    });

    btn.addEventListener('click', processTable);
    document.body.appendChild(btn);
}

// Initialize
createUpdateButton();
// Optional: Run once on load
processTable();