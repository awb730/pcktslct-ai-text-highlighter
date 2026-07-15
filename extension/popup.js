const MODE_KEY = "selectai_mode";
const HISTORY_KEY = "pocketselect_history";
const DEFAULT_MODE = "explain";

document.addEventListener("DOMContentLoaded", () => {
    const modeSelect = document.getElementById("mode-select");
    const status = document.getElementById("status");
    const historyList = document.getElementById("history-list");
    const clearBtn = document.getElementById("clear-history");

    // --- Existing mode logic (unchanged) ---
    chrome.storage.sync.get(MODE_KEY, (result) => {
        modeSelect.value = result[MODE_KEY] || DEFAULT_MODE;
    });

    modeSelect.addEventListener("change", () => {
        chrome.storage.sync.set({ [MODE_KEY]: modeSelect.value });
        status.style.opacity = "1";
        setTimeout(() => { status.style.opacity = "0"; }, 1500);
    });

    // --- History ---
    loadHistory();

    clearBtn.addEventListener("click", () => {
        chrome.storage.local.remove(HISTORY_KEY, () => {
            historyList.innerHTML = '<div class="history-empty">No history yet.</div>';
        });
    });

    function loadHistory() {
        chrome.storage.local.get(HISTORY_KEY, (result) => {
            const history = result[HISTORY_KEY] || [];

            if (history.length === 0) {
                historyList.innerHTML = '<div class="history-empty">No history yet.</div>';
                return;
            }

            historyList.innerHTML = history.map((item, index) => {
                const date = new Date(item.timestamp);
                const time = date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                });
                const mode = item.mode[0].toUpperCase() + item.mode.slice(1, item.mode.length)
                return `
                    <div class="history-item" data-index="${index}">
                        <div class="history-meta">
                            <span>${mode}</span>
                            <span>${time}</span>
                        </div>
                        <div class="history-input">${escapeHtml(item.input)}</div>
                        <div class="history-response">${escapeHtml(item.response)}</div>
                    </div>
                `;
            }).join("");
        });
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
});