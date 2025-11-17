# **ChatGPT Traffic Gate — AutoPilot v2.1 (Safe, Adaptive)**

### *A stability-focused, defensive browser extension for ChatGPT.*

ChatGPT can freeze, stall, or load thousands of old messages at once. This extension reduces those issues using **conservative, rule-based controls** applied at the network, DOM, and UI layers. It avoids reload loops and aims to stabilize long sessions with minimal user interaction.

This version prioritizes **safety** and **predictable behavior** over aggressiveness.

---

# ⭐ Core Capabilities

All features below are directly implemented in the code — **no assumptions**, no claims of universal behavior.

---

## 🚦 **Selective History Gating (Network Layer)**

The extension intercepts requests to known ChatGPT history endpoints and cancels them **only if**:

* The request includes explicit pagination (cursor, before, page, offset, etc.)
* The hostname matches ChatGPT
* The user has not recently indicated intent to load older messages
* No temporary “allow” window is active
* The feature is enabled in settings

This prevents ChatGPT from automatically fetching very large histories.

History is **never blocked blindly**. If you manually toggle the gate or use the “Allow 10s” button, requests temporarily pass through.

---

## 📉 **JSON Thinning (Only on Large Responses)**

Some history endpoints return extremely large JSON payloads.

When the extension detects:

* `messages[]` arrays
* `items[]` arrays
* `mapping{}` objects

that exceed a safe threshold, the response is cloned and reduced to the *last 60 entries* (or fewer if AutoPilot lowers that threshold).

This avoids multi-megabyte JSON from causing freezes.

---

## 🧹 **DOM SoftCap (Safe Trimming)**

ChatGPT accumulates DOM nodes for each turn in the conversation.
This extension:

* Detects the container holding chat turns
* Removes older nodes when the count exceeds the configured limit
* Hides the container while trimming to avoid visible flicker
* Dispatches a custom event (`tg-unshield`) after the first successful trim

This helps prevent slowdowns caused by large DOMs.
SoftCap thresholds can be adjusted at runtime by AutoPilot.

---

## 🧠 **AutoPilot (Adaptive Rule Engine)**

AutoPilot runs every ~40 seconds and evaluates lightweight telemetry:

* History cancels
* Disconnect indicators
* Browser longtasks
* Observed turn count
* Last known SoftCap level

Based on conditions, it **adjusts internal settings**, including:

* SoftCap keep-count (up or down)
* Scroll threshold sensitivity (used for intent signaling)
* Keepalive interval
* Whether reloads are allowed
* Whether auto-reconnect is enabled

AutoPilot does **not** use machine learning.
It is a deterministic ruleset that adjusts parameters within safe, bounded ranges.

---

## 🔄 **KeepAlive (Session Warmth & Recovery)**

KeepAlive:

* Sends low-frequency, jittered HEAD/GET requests to stable endpoints
* Avoids patterns or rapid pings
* Optionally triggers reconnect attempts
* Optionally performs safe reloads (with cooldowns)
* Avoids reloads while typing or when tab is hidden
* Detects reconnect/error banners and clicks retry buttons when possible

Reload behavior is *disabled by default*, and only enabled if AutoPilot determines the session is repeatedly disconnecting.

---

## 🛡️ **Early Shield (Startup Guard)**

During initial page load:

* A lightweight CSS shield temporarily hides the conversation
* The shield is removed automatically after SoftCap trims or after a 2.5s fallback timer

This prevents large DOM loads before trimming can occur.

---

## 🧩 **Traffic UI Pill**

A small optional pill displays:

* AutoPilot indicator
* A toggle for the history gate
* A 10-second “Allow History” button

The pill reduces opacity over time, but behavior may vary depending on browser, theme, or user hardware.

No functional behavior depends on hover.

---

# 🔧 Installation

### **Firefox**

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json`

### **Chrome / Edge**

1. Go to `chrome://extensions`
2. Enable **Developer Mode**
3. Select **Load Unpacked**
4. Choose the project folder

---

# 🔒 Safety & Privacy

* No data is sent to external servers
* No messages or prompts are logged
* Only interacts with ChatGPT’s origins
* Reloads are opt-in and rate-limited
* All logic runs locally

---

# 📘 Design Philosophy

This extension aims to be:

### **• Safe**

No aggressive reload loops, no fragile hacks, no overrides of ChatGPT UI behavior unless necessary.

### **• Conservative**

Every adaptive behavior is bounded and reversible.

### **• Intent-based**

History loads are allowed when the user indicates intent, either via scroll or via the UI button.

### **• Minimalistic**

No heavy UI. No analytics. Small code footprint.

---

# 📄 License

MIT License

---

If you want a **short version**, **marketing version**, or a **technical deep-dive version**, I can generate those too.
