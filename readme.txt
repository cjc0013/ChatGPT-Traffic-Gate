ChatGPT Traffic Gate

A lightweight Firefox extension that keeps super-long ChatGPT sessions stable and usable.
It prevents lag, freezes, giant history loads, and random disconnects by controlling network traffic, soft-capping DOM growth, and keeping the session alive.

Features

Blocks oversized history loads before the DOM chokes

Soft-hides old messages (never deletes them) to reduce rendering cost

Prevents UI freezes and input lockups in huge conversations

Keeps the session alive with intelligent background pings

Stabilizes massive chats that normally crash or stop loading

Zero UI disruption — everything stays readable and scrollable

Works automatically once installed

Why this exists

ChatGPT becomes slow or unusable in very long chats.
This extension fixes that by managing the things that actually break the page:

heavy JSON histories

DOM bloat

WebSocket backlog

session timeout loops

infinite “loading…” states

It doesn’t reset your chat or destroy content — it just keeps the tab alive.

Installation (Temporary / Dev Mode)

Download or clone this repo

Open about:debugging in Firefox

Click “This Firefox” → “Load Temporary Add-on”

Select manifest.json

Notes

This extension does not modify ChatGPT’s backend or intercept private data.

All messages remain intact; only rendering weight is reduced.

Designed specifically for extreme long-form sessions.

License

MIT
