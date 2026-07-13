const MODE_KEY = "selectai_mode";
const DEFAULT_MODE = "explain";

document.addEventListener("DOMContentLoaded", () => {
    const modeSelect = document.getElementById("mode-select");
    const status = document.getElementById("status");
    let statusTimeout = null;

    chrome.storage.sync.get(MODE_KEY, (result) => {
        modeSelect.value = result[MODE_KEY] || DEFAULT_MODE;
    });

    modeSelect.addEventListener("change", () => {
        const mode = modeSelect.value;
        chrome.storage.sync.set({ [MODE_KEY]: mode }, () => {
            status.classList.add("visible");

            if (statusTimeout) clearTimeout(statusTimeout);
            statusTimeout = setTimeout(() => {
                status.classList.remove("visible");
            }, 1500);
        });
    });
});
