# FREE — PROJECT MAYHEM

> You were sold a story that you are what you own, what you scroll, what you buy next.
> It is a lie, and it is expensive. This is where you stop being their business.

**Project Mayhem** is a local-first liberation engine. One small assignment a day —
chosen by you, done fully — that breaks the autopilot of consumption and comfort.
Let something go. Kill a feed. Sit in the silence you've been running from. Talk to
the stranger. Give without being seen. None of it is heroic. All of it is a crack
in the wall.

It is not about hating things. It's about ending the trance where things quietly run
your life while you call it freedom.

## What it does

- **TODAY** — a single assignment, front and center. Accept it, do it, log a field report.
- **ASSIGNMENTS** — 50 small mutinies across five disciplines. Pick your fight.
- **LEDGER** — what you've let go of and what you took back. It only counts up.
- **MANIFESTO** — why we do this, and the eight rules.

### The five disciplines

| | | |
|---|---|---|
| **DETACHMENT** | The things you own end up owning you. | purge, donate, one-in-one-out |
| **SIGNAL** | Kill the feeds that feed on you. | unfollow, unplug, cancel |
| **PRESENCE** | This is your life and it is ending one minute at a time. | silence, slowness, attention |
| **COURAGE** | Do the thing that scares the comfortable version of you. | strangers, solitude, cold |
| **GENEROSITY** | You are not the money in your account. | give, thank, tip, teach |

Every assignment is a **healthy, non-harmful** act of self-liberation. Nothing here
hurts anyone. You pick a fight with your comfort, not a person.

## The first rule

**You own this.** No accounts. No tracking. No servers. No corporation holding your
data hostage. Everything lives in your browser's `localStorage`, on your machine.
Export it whenever you want — it's a plain JSON file, and it's yours. Self-destruct
wipes it clean in one click. When you close the tab, it owes you nothing.

## Run it

No build step. No `npm install`. No dependencies. It's HTML, CSS, and three small
ES modules. Serve the folder any way you like:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Or open it behind any static host. It works fully offline — no CDNs, no remote
fonts, no network calls. Ever.

## How it's built

```
index.html         app shell + view containers
css/mayhem.css     the whole design system (industrial, monochrome, one acid accent)
js/data.js         content — 50 assignments, 5 disciplines, 8 rules, the manifesto
js/store.js        state, streaks, ledger, export/import — persists to localStorage
js/app.js          hash router + rendering + wiring
```

`store.js` is decoupled from `data.js`: assignments carry their own category and any
`tracks` (things released / money reclaimed), and the store snapshots that when you
accept one. Streaks are computed in local time — no UTC drift. Import validates its
input and never throws. `getState()` hands back a copy so nothing can mutate the store
behind its back.

## The rules of Project Mayhem

Open the app. Read the MANIFESTO. Then set one thing down, and feel how light your
own two hands actually are.

Start today. Start badly. Start with one thing. The life you keep putting off is the
only one you get, and it is already running.

Begin.
