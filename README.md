# PocketSelectAI

A Chrome extension that lets you highlight any text on any webpage and instantly get an AI-powered explanation via a floating tooltip - no more copy-pasting and switching tabs.

![PocketSelectAI Demo](https://img.shields.io/badge/status-live-brightgreen) ![Manifest V3](https://img.shields.io/badge/manifest-v3-blue) ![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688) ![GPT-4o](https://img.shields.io/badge/model-GPT--4o-412991)

---

## How it works

1. Highlight any text on any webpage
2. Click the **✦ Ask Pocket** button that appears
3. A tooltip renders GPT-4o's explanation right next to your selection

The extension communicates with a FastAPI backend deployed on Render, which securely holds the OpenAI API key and sends requests to GPT-4o.

---

## Architecture

```
Chrome Extension (MV3)
├── content.js        → detects selection, injects button + tooltip UI
├── background.js     → service worker, makes fetch calls to backend
├── tooltip.css       → styles injected into every page
└── manifest.json     → permissions, host rules, content script config

FastAPI Backend (Render)
└── main.py           → POST /ask → OpenAI GPT-4o → JSON response
```

**Why a backend instead of calling OpenAI directly from the extension?**

Calling the OpenAI API directly from a Chrome extension would expose your API key in the extension's source code. Therefore, anyone who installs it could extract the key from the bundle. The FastAPI backend keeps the key server-side in an environment variable, and the extension only ever talks to my own personal endpoint.

---

## Tech stack

| Layer | Technology |
|---|---|
| Extension | Chrome MV3 · Vanilla JS · CSS |
| Backend | Python · FastAPI · OpenAI API |
| AI Model | GPT-4o |
| Deployment | Render (backend) |
| Auth / Key mgmt | Environment variables via Render dashboard |

---

## Project structure

```
select-ai/
├── backend/
│   ├── main.py              # FastAPI app with /ask and /health endpoints
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Local env
├── extension/
│   ├── manifest.json        # Extension config (MV3)
│   ├── content.js           # Injected into every page
│   ├── background.js        # Service worker / API proxy
│   ├── tooltip.css          # Floating UI styles
│   └── icons/               # PNGs
├── .gitignore
└── README.md
```

---

## Key concepts

**Manifest V3** - this is the current Chrome extension standard. Service workers replace persistent background pages, and fetch calls from content scripts are restricted, which is why message passing to `background.js` is required.

**Message passing** - content scripts and service workers live in separate contexts and can't call each other's functions directly. `chrome.runtime.sendMessage` / `onMessage` is the bridge between them.

**Content script isolation** - `content.js` shares the DOM with the webpage but runs in an isolated JS environment. The page scripts can't access extension variables and vice versa.

**`return true` in onMessage** - this is required when the response callback is asynchronous. Without it, Chrome closes the message channel before the fetch resolves.

---

## Potential Future Updates

- [ ] Multiple modes: summarize, translate, define, simplify
- [ ] Popup settings panel to configure the default mode
- [ ] Response history
- [ ] Streaming responses token by token
- [ ] Right-click context menu as an alternative trigger

---

## Author

Allen Baez - Senior CS student at Montclair State University  
[GitHub](https://github.com/awb730) · [LinkedIn](https://linkedin.com/in/albaez2005)