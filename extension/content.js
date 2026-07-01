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
    button.textContent = "✦ Ask AI";

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
    showTooltip("loading"); // show a loading state immediately

    // Send a message to the background service worker.
    // chrome.runtime.sendMessage is how content scripts talk to background scripts.
    // The background script will make the actual fetch call and send back the response.
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