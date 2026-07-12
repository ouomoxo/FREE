# FREE — SOAP

> The stuff you post is covered in fingerprints. You can't see them.
> Everyone else can. This washes them off.

**SOAP** is a scrubbing station for your own files. Drop in a photo and it does two things,
in this order:

1. **Exposes** the surveillance metadata you didn't know you were broadcasting — the exact
   GPS coordinates where you stood, the make, model and serial of the device in your pocket,
   the timestamp down to the second, the software that touched it, your name if the camera
   wrote it in.
2. **Washes** it out — strips every metadata block and hands the file back, byte-verified
   clean, so you can post it naked of tracking data.

First the truth. Then you disappear.

## The first rule

**It sends nothing.** No upload. No server. No account. No telemetry. No CDN, no remote
font, no map tile — zero outbound requests of any kind. Every byte is read, exposed and
scrubbed inside your own browser, on your own machine. Close the tab and there is no trace,
because there was never a copy anywhere but here. A privacy tool that phones home is a lie.
This one doesn't have a mouth.

Ironic, isn't it — everything else you touch renders you down and sells you back to yourself.
This just cleans you off and lets you go.

## What it reads (and removes)

| Format | Exposed | Scrubbed |
|---|---|---|
| **JPEG** | EXIF (GPS location, camera make/model/serial, lens, date-taken, software, artist, copyright), XMP, IPTC, ICC, embedded comments | all `APP1`–`APP15` + comment segments dropped; image data kept byte-for-byte |
| **PNG** | `tEXt` / `zTXt` / `iTXt` text records, embedded `eXIf`, `tIME` | those chunks dropped; every critical & rendering chunk kept byte-for-byte |

Everything else passes through untouched — it will never corrupt a file it doesn't understand.

## Run it

No build step. No `npm install`. No dependencies. Static HTML, CSS and two ES modules.

```bash
python3 -m http.server 8080
# then open http://localhost:8080 and drag a photo in
```

Works fully offline. Pull your network cable — it doesn't care. That's the point.

## How it's built

```
index.html         drop zone, interrogation cards, wash controls
css/soap.css       darkroom design system — amber for what you leak, cyan for what's washed
js/exif.js         the engine: analyze() reads metadata, scrub() removes it. Pure, never throws.
js/soap.js         drag/drop, exposé rendering, wash + download, re-scan-to-prove-clean
```

`exif.js` is a pure binary engine — no DOM, no network. It walks JPEG marker segments and
PNG chunks by hand, parses the EXIF TIFF tree (IFD0 → Exif SubIFD → GPS IFD, both
endiannesses) to turn GPS rationals into signed decimal degrees, and removes metadata by
dropping whole segments/chunks so the pixel data is never re-encoded and never degraded.
It is fuzzed against garbage input and refuses to throw or corrupt.

After every wash, SOAP re-scans the cleaned bytes and shows you the count of fingerprints
left. It should say zero. Don't take my word for it — the tool checks its own work in front
of you.

## Why

You are not your location history. You are not the serial number of your phone. You are not
the metadata a company reads off your vacation photo to know where you sleep. They built a
machine to render every trace of you into a product. So here's a bar of soap.

Wash up. Leave no trace.
