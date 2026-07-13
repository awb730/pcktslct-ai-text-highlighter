// background.js is the service worker. It runs in the background,
// separate from any webpage. It CAN make fetch requests to external servers.
// It wakes up when the content script sends it a message.

const BACKEND_URL = "https://ai-text-highlighter.onrender.com/ask";
const IMAGE_BACKEND_URL = "https://ai-text-highlighter.onrender.com/ask-image";
const MODE_KEY = "selectai_mode";
const DEFAULT_MODE = "explain";

async function getSavedMode() {
    const result = await chrome.storage.sync.get(MODE_KEY);
    return result[MODE_KEY] || DEFAULT_MODE;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "CAPTURE_REGION") {
        getSavedMode()
            .then((mode) => captureRegionBackend(message.rect, message.dpr, sender.tab?.windowId, mode))
            .then((result) => sendResponse({ result }))
            .catch((err) => sendResponse({ error: err.message }));
        return true;
    }

    if (message.type === "ASK_AI_IMAGE") {
        getSavedMode()
            .then((mode) => callImageBackend(message.imageSrc, mode))
            .then((result) => sendResponse({ result }))
            .catch((err) => sendResponse({ error: err.message }));
        return true;
    }

    if (message.type !== "ASK_AI") return;

    // We must return true here to tell Chrome we'll call sendResponse asynchronously.
    // Without this, the message channel closes before our fetch finishes.
    getSavedMode()
        .then((mode) => callBackend(message.text, mode))
        .then((result) => sendResponse({ result }))
        .catch((err) => sendResponse({ error: err.message }));

    return true; // <-- critical: keeps the message channel open
});

async function callBackend(text, mode = DEFAULT_MODE) {
    const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode }),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server error: ${res.status}`);
    }

    const data = await res.json();
    return data.response;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result;
            // JS split limit is max array length, not max splits — use indexOf, not split(",", 1).
            resolve(dataUrl.substring(dataUrl.indexOf(",") + 1));
        };
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(blob);
    });
}

async function callImageBackend(imageSrc, mode = DEFAULT_MODE) {
    const res = await fetch(imageSrc);
    if (!res.ok) {
        throw new Error(`Failed to fetch image: ${res.status}`);
    }

    const blob = await res.blob();
    const base64String = await blobToBase64(blob);

    const apiRes = await fetch(IMAGE_BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_data: base64String, mode }),
    });

    if (!apiRes.ok) {
        const data = await apiRes.json().catch(() => ({}));
        throw new Error(data.detail || `Server error: ${apiRes.status}`);
    }

    const data = await apiRes.json();
    return data.response;
}

const DEFAULT_SCREENSHOT_WIDTH = 1920;
const DEFAULT_SCREENSHOT_HEIGHT = 1080;

function uint8ArrayToBase64(uint8Array) {
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

async function captureRegionBackend(rect, dpr, windowId, mode = DEFAULT_MODE) {
    let captureWindowId = windowId;
    if (captureWindowId == null) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        captureWindowId = tab?.windowId;
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(captureWindowId, { format: "png" });

    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const fullCanvas = new OffscreenCanvas(
        bitmap.width || DEFAULT_SCREENSHOT_WIDTH,
        bitmap.height || DEFAULT_SCREENSHOT_HEIGHT
    );
    const fullCtx = fullCanvas.getContext("2d");
    fullCtx.drawImage(bitmap, 0, 0);

    const cropX = Math.round(rect.left * dpr);
    const cropY = Math.round(rect.top * dpr);
    const cropWidth = Math.round(rect.width * dpr);
    const cropHeight = Math.round(rect.height * dpr);

    const imageData = fullCtx.getImageData(cropX, cropY, cropWidth, cropHeight);

    const cropCanvas = new OffscreenCanvas(cropWidth, cropHeight);
    cropCanvas.getContext("2d").putImageData(imageData, 0, 0);

    const croppedBlob = await cropCanvas.convertToBlob({ type: "image/png" });
    const arrayBuffer = await croppedBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64 = uint8ArrayToBase64(uint8Array);

    const apiRes = await fetch(IMAGE_BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_data: base64, mode }),
    });

    if (!apiRes.ok) {
        const data = await apiRes.json().catch(() => ({}));
        throw new Error(data.detail || `Server error: ${apiRes.status}`);
    }

    const data = await apiRes.json();
    return data.response;
}

// Manifest command invokes activeTab, which captureVisibleTab requires.
chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "toggle-snip") return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SNIP" });
});