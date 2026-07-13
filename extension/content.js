// content.js runs in the context of every webpage.
// It has access to the DOM but NOT to chrome.storage or fetch (for our use case).

let button = null;        // the floating "Ask AI" button
let tooltip = null;       // the response panel
let selectedText = "";    // what the user highlighted


// --- Step 1: Listen for text selection ---
// mouseup fires after the user releases the mouse, at which point
document.addEventListener("mouseup", (event) => {
    const selection = window.getSelection(); // window.getSelection() will contain the highlighted text.
    const text = selection.toString().trim();

    // If nothing is selected, or the click was on our own button/tooltip, bail out
    if (!text || isOurElement(event.target)) return;

    selectedText = text;

    // Get the bounding box of the selection so we know where to place the button
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    showButton(rect);
});

    // If the user clicks somewhere with no selection, clean everything up
document.addEventListener("mousedown", (event) => {
    if (!isOurElement(event.target)) {
        removeButton();
        removeTooltip();
    }
});


// --- Step 2: Render the floating button ---
function showButton(rect) {
    removeButton(); // remove any existing button first

    button = document.createElement("div");
    button.id = "selectai-button";
    button.textContent = "✦ Ask Pocket";

    // Position: just above and to the right of the selection.
    // We use pageY (not clientY) so it stays correct when the page is scrolled.
    // rect.top is relative to the viewport, so we add window.scrollY.
    button.style.top = `${rect.top + window.scrollY - 40}px`;
    button.style.left = `${rect.left + window.scrollX}px`;

    button.addEventListener("click", handleButtonClick);
    document.body.appendChild(button);
}

// --- Step 3: Handle the click ---
function handleButtonClick() {
    removeTooltip();
    showTooltip("loading");

    // Guard against invalidated extension context (happens after reload/update)
    // Send a message to the background service worker.
    // chrome.runtime.sendMessage is how content scripts talk to background scripts.
    // The background script will make the actual fetch call and send back the response.
    if (!chrome.runtime?.id) {
        showTooltip("error", "Extension was reloaded. Please refresh this page.");
        return;
    }

    try {
        chrome.runtime.sendMessage(
            { type: "ASK_AI", text: selectedText },
            (response) => {
                if (chrome.runtime.lastError) {
                    showTooltip("error", "Extension error. Try reloading the page.");
                    return;
                }
                if (response.error) {
                    showTooltip("error", response.error);
                } else {
                    showTooltip("result", response.result);
            }
            }
        );
    } catch (err) {
        showTooltip("error", "Extension was reloaded. Please refresh this page.");
    }
}


// --- Step 4: Show the response tooltip ---
function showTooltip(state, text = "") {
    removeTooltip();

    // Find the button's position so we can place the tooltip below it
    const btnRect = button ? button.getBoundingClientRect() : null;
    
    const top = btnRect ? btnRect.bottom + window.scrollY + 8 : 100;
    
    const left = btnRect ? Math.max(10, btnRect.left + window.scrollX) : 10;

    tooltip = document.createElement("div");
    tooltip.id = "selectai-tooltip";
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    if (state === "loading") {
        tooltip.innerHTML = `
        <div class="selectai-loading">
            <span></span><span></span><span></span>
        </div>
        `;

    } else if (state === "error") {
        tooltip.innerHTML = `<div class="selectai-error">${escapeHtml(text)}</div>`;
    } else {
        // Response text
        tooltip.innerHTML = `
            <button class="selectai-close" id="selectai-close-btn">✕</button>
            <div class="selectai-text">${escapeHtml(text)}</div>
        `;
        document.body.appendChild(tooltip);

        // Close Button
        document.getElementById("selectai-close-btn").addEventListener("click", () => {
            removeTooltip();
            removeButton();
        });
        return; // already appended above
    }

    document.body.appendChild(tooltip);
}


// --- Helper Functions ---
function removeButton() {
    if (button) { button.remove(); button = null; }
}

function removeTooltip() {
    if (tooltip) { tooltip.remove(); tooltip = null; }
}

// Prevent clicks on our UI from triggering the mousedown cleanup
function isOurElement(el) {
    return el?.closest("#selectai-button, #selectai-tooltip");
}

// Always escape user-facing strings to prevent XSS.
// Even though the text came from the AI, it's good practice.
function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// --- Image click: ask AI about a clicked <img> ---
function positionTooltipNearImage(imgRect) {
    if (!tooltip) return;
    tooltip.style.top = `${imgRect.top + window.scrollY + imgRect.height + 8}px`;
    tooltip.style.left = `${imgRect.left + window.scrollX}px`;
}

document.addEventListener("click", (event) => {
    if (event.target.tagName !== "IMG") return;
    if (isOurElement(event.target)) return;

    const imageSrc = event.target.src;
    const imgRect = event.target.getBoundingClientRect();

    removeTooltip();
    removeButton();
    showTooltip("loading");
    positionTooltipNearImage(imgRect);

    if (!chrome.runtime?.id) {
        showTooltip("error", "Extension was reloaded. Please refresh this page.");
        positionTooltipNearImage(imgRect);
        return;
    }

    try {
        chrome.runtime.sendMessage(
            { type: "ASK_AI_IMAGE", imageSrc },
            (response) => {
                if (chrome.runtime.lastError) {
                    showTooltip("error", "Extension error. Try reloading the page.");
                    positionTooltipNearImage(imgRect);
                    return;
                }
                if (response.error) {
                    showTooltip("error", response.error);
                } else {
                    showTooltip("result", response.result);
                }
                positionTooltipNearImage(imgRect);
            }
        );
    } catch (err) {
        showTooltip("error", "Extension was reloaded. Please refresh this page.");
        positionTooltipNearImage(imgRect);
    }
});

// --- Screen region snip: Alt+S to capture a region ---
let snipOverlay = null;
let snipSelection = null;

function positionTooltipAtScrollCoords(pageTop, pageLeft) {
    if (!tooltip) return;
    tooltip.style.top = `${pageTop}px`;
    tooltip.style.left = `${pageLeft}px`;
}

function activateSnipMode() {
    snipOverlay = document.createElement("div");
    snipOverlay.id = "selectai-snip-overlay";
    snipOverlay.style.position = "fixed";
    snipOverlay.style.top = "0";
    snipOverlay.style.left = "0";
    snipOverlay.style.width = "100vw";
    snipOverlay.style.height = "100vh";
    snipOverlay.style.zIndex = "2147483645";
    snipOverlay.style.cursor = "crosshair";
    snipOverlay.style.background = "rgba(0,0,0,0.3)";
    document.body.appendChild(snipOverlay);

    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;
    let isDragging = false;

    snipOverlay.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        snipSelection = document.createElement("div");
        snipSelection.id = "selectai-snip-selection";
        snipSelection.style.position = "fixed";
        snipSelection.style.border = "2px solid #7878dd";
        snipSelection.style.background = "rgba(120,120,221,0.15)";
        snipSelection.style.pointerEvents = "none";
        snipSelection.style.zIndex = "2147483646";
        document.body.appendChild(snipSelection);
    });

    snipOverlay.addEventListener("mousemove", (e) => {
        if (!isDragging || !snipSelection) return;

        const currentX = e.clientX;
        const currentY = e.clientY;

        snipSelection.style.left = `${Math.min(startX, currentX)}px`;
        snipSelection.style.top = `${Math.min(startY, currentY)}px`;
        snipSelection.style.width = `${Math.abs(currentX - startX)}px`;
        snipSelection.style.height = `${Math.abs(currentY - startY)}px`;
    });

    snipOverlay.addEventListener("mouseup", (e) => {
        if (!isDragging) return;
        isDragging = false;
        endX = e.clientX;
        endY = e.clientY;

        snipOverlay.remove();
        snipOverlay = null;

        if (snipSelection) {
            snipSelection.remove();
            snipSelection = null;
        }

        const dragWidth = Math.abs(endX - startX);
        const dragHeight = Math.abs(endY - startY);
        if (dragWidth > 10 && dragHeight > 10) {
            captureRegion(startX, startY, endX, endY);
        }
    });
}

function captureRegion(x1, y1, x2, y2) {
    const rect = {
        left: Math.min(x1, x2),
        top: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
    };

    const tooltipTop = rect.top + window.scrollY;
    const tooltipLeft = rect.left + window.scrollX;

    removeTooltip();
    removeButton();
    showTooltip("loading");
    positionTooltipAtScrollCoords(tooltipTop, tooltipLeft);

    if (!chrome.runtime?.id) {
        showTooltip("error", "Extension was reloaded. Please refresh this page.");
        positionTooltipAtScrollCoords(tooltipTop, tooltipLeft);
        return;
    }

    try {
        chrome.runtime.sendMessage(
            { type: "CAPTURE_REGION", rect, dpr: window.devicePixelRatio },
            (response) => {
                if (chrome.runtime.lastError) {
                    showTooltip("error", "Extension error. Try reloading the page.");
                    positionTooltipAtScrollCoords(tooltipTop, tooltipLeft);
                    return;
                }
                if (response.error) {
                    showTooltip("error", response.error);
                } else {
                    showTooltip("result", response.result);
                }
                positionTooltipAtScrollCoords(tooltipTop, tooltipLeft);
            }
        );
    } catch (err) {
        showTooltip("error", "Extension was reloaded. Please refresh this page.");
        positionTooltipAtScrollCoords(tooltipTop, tooltipLeft);
    }
}

function toggleSnipMode() {
    const existingOverlay = document.getElementById("selectai-snip-overlay");
    if (existingOverlay) {
        existingOverlay.remove();
        snipOverlay = null;
        document.getElementById("selectai-snip-selection")?.remove();
        snipSelection = null;
        return;
    }

    activateSnipMode();
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TOGGLE_SNIP") {
        toggleSnipMode();
    }
});