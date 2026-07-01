// background.js is the service worker. It runs in the background,
// separate from any webpage. It CAN make fetch requests to external servers.
// It wakes up when the content script sends it a message.

const BACKEND_URL = "http://localhost:8000/ask"; // change to render

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "ASK_AI") return;

    // We must return true here to tell Chrome we'll call sendResponse asynchronously.
    // Without this, the message channel closes before our fetch finishes.
    callBackend(message.text)
        .then((result) => sendResponse({ result }))
        .catch((err) => sendResponse({ error: err.message }));

    return true; // <-- critical: keeps the message channel open
});

async function callBackend(text) {
    const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode: "explain" }),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server error: ${res.status}`);
    }

    const data = await res.json();
    return data.response;
}