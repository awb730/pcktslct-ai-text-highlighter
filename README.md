# PocketSelectAI ✦

A Chrome extension that brings AI analysis to anything on your screen. Such as highlighted text, images, video frames, or any region you drag to select. Powered by GPT-4o Vision and a secure FastAPI backend.


![Status](https://img.shields.io/badge/status-live-brightgreen) ![Manifest V3](https://img.shields.io/badge/manifest-v3-blue) ![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688) ![GPT-4o](https://img.shields.io/badge/model-GPT--4o-412991)

---

## What it does

| Trigger | How | Result |
|---|---|---|
| **Text** | Highlight any text on any page | Floating AI tooltip appears next to selection |
| **Image** | Click any image on a page | GPT-4o Vision describes or analyzes it |
| **Video** | Click any HTML5 video | Current frame is captured and analyzed |
| **Screen region** | Press `Alt+S`, drag a rectangle | Any part of the screen sent to GPT-4o Vision |

Switch between four response modes from the popup panel:
- **Explain** - clear, concise explanation in 2-4 sentences
- **Summarize** - key points in bullet form
- **Translate** - converts content to English
- **Simplify** - plain language explanation for any audience

All responses are saved to a local history panel within the popup menu and no data leaves your browser except to your own backend.

---

## Demo

> Highlight a paragraph -> click **✦ Ask Pocket** -> GPT-4o explanation appears inline

> Press `Alt+S` -> drag over a chart, diagram, or anything on the screen -> instant AI analysis

> Click a playing video → green border flashes → GPT-4o describes the current frame of the video

---

## Architecture

```
PocketSelectAI/
├── extension/                  # Chrome extension
│   ├── manifest.json           # Permissions, shortcuts, content script config
│   ├── content.js              # Injected into every page - handles all UI and triggers
│   ├── background.js           # Service worker - API calls, history, screenshot capture
│   ├── tooltip.css             # Floating UI styles injected into every page
│   ├── popup.html              # Toolbar popup - mode selector + history panel
│   ├── popup.js                # Popup logic - reads/writes chrome.storage
│   └── icons/                  # 16x16, 48x48, 128x128 PNGs (Logos)
└── backend/
    ├── main.py                 # FastAPI app - /ask and /ask-image endpoints
    ├── requirements.txt        # Python dependencies
    └── .env                    # Local env vars (never committed)
```

<!-- ### How the pieces connect

```
User interaction (content.js)
        │
        │  chrome.runtime.sendMessage
        ▼
Service worker (background.js)
        │
        │  fetch()
        ▼
FastAPI backend (Render)
        │
        │  OpenAI SDK
        ▼
GPT-4o / GPT-4o Vision
        │
        │  JSON response
        ▼
Tooltip UI rendered on page (content.js)
        │
        │  chrome.storage.local
        ▼
History panel (popup.js)
``` -->

### Why a backend instead of calling OpenAI directly?

Calling the OpenAI API directly from a Chrome extension exposes your API key in the extension bundle — anyone who installs it can extract it. The FastAPI backend keeps the key in a server-side environment variable. The extension only ever talks to your own endpoint.

### Why convert images/video to base64 in `content.js` not `background.js`?

Content scripts run inside the actual browser tab, which means images already rendered on the page can be drawn to a canvas without triggering CORS restrictions. The service worker makes fresh network requests that third-party CDNs often block. Drawing to canvas in the content script and passing raw base64 to the service worker sidesteps this entirely.

### Why `return true` in the `onMessage` listener?

Chrome closes the message channel immediately after the listener returns unless you return `true`. Since all our backend calls are async (fetch), we must return `true` to keep the channel open until `sendResponse` is called.

---

## Tech stack

| Layer | Technology |
|---|---|
| Extension | Chrome MV3 · JavaScript · CSS |
| Background | Chrome Service Worker |
| AI Snippet Tool | Canvas API → base64 → GPT-4o Vision |
| Screen Capture | `chrome.tabs.captureVisibleTab` + `OffscreenCanvas` |
| Backend | Python · FastAPI · OpenAI SDK |
| AI Model | GPT-4o (text + vision) |
| Storage | `chrome.storage.sync` (mode) · `chrome.storage.local` (history) |
| Deployment | Render (backend) |

---

<!-- ## Local development until published on Chrome Web Store

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/pocket-select-ai.git
cd pocket-select-ai
```

### 2. Set up the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```
OPENAI_API_KEY=sk-...your-key-here...
```

Start the server:

```bash
uvicorn main:app --reload
```

Test it:

```bash
# Text endpoint
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"text": "Photosynthesis is the process by which plants convert light into energy", "mode": "explain"}'

# Vision endpoint (1x1 pixel PNG)
curl -X POST http://localhost:8000/ask-image \
  -H "Content-Type: application/json" \
  -d '{"image_data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "mode": "describe"}'
```

### 3. Load the extension in Chrome

1. In `extension/background.js`, set `BACKEND_URL` and `IMAGE_BACKEND_URL` to your localhost URLs
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `extension/` folder
5. Visit any webpage and try all four triggers

---

## Deploying the backend to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service → connect your repo
3. Set **Root Directory** to `backend`
4. Set **Build Command** to `pip install -r requirements.txt`
5. Set **Start Command** to `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Under **Environment**, add `OPENAI_API_KEY` = your OpenAI key
7. Deploy — Render gives you a live URL

Then in `extension/background.js` update:

```javascript
const BACKEND_URL = "https://your-service.onrender.com/ask";
const IMAGE_BACKEND_URL = "https://your-service.onrender.com/ask-image";
```

And in `extension/manifest.json` update `host_permissions`:

```json
"host_permissions": [
  "https://your-service.onrender.com/*"
]
```

Reload the extension in `chrome://extensions`.

--- -->

## Important Concepts for Building an Extension

**Manifest V3** - the current Chrome extension standard. Persistent background pages are replaced by service workers that wake up on demand, and CORS fetch moves entirely to the service worker context.

**Message passing** - content scripts and service workers live in JavaScript environments and communicate via `chrome.runtime.sendMessage` or `onMessage`. The content script handles all DOM interaction; the service worker handles all network requests.

**Canvas frame capture** - both image analysis and video frame capture work by drawing the source element onto an HTML5 canvas and calling `toDataURL("image/png")`. The resulting base64 string is sent to GPT-4o Vision with no additional processing needed.

**Screen region snipping** - `chrome.tabs.captureVisibleTab()` takes a full screenshot of the current tab as a base64 PNG. An `OffscreenCanvas` in the service worker crops it to the user's liking before sending to the backend.

**Content script isolation** - `content.js` shares the DOM with the webpage but runs in a sandboxed JavaScript context. Page scripts cannot access extension variables and vice versa.

---

## Potential extensions

- [ ] Streaming responses rendered character by character
- [ ] Right-click context menu as an alternative trigger
- [ ] Export history to a new response
- [ ] Custom system prompt editor in the popup
- [ ] Chrome Web Store publication

---

## Author

Allen Baez - CS student at Montclair State University  
[LinkedIn](https://linkedin.com/in/albaez2005)