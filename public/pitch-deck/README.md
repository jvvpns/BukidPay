# BukidPay HTML pitch deck

This folder contains the offline-capable four-slide hackathon deck and four Q&A backup slides.

Open `index.html` directly, or run the BukidPay application and visit:

```text
http://localhost:3000/pitch-deck/index.html
```

Controls:

- `ArrowRight`, `Space`, or `PageDown` — next slide
- `ArrowLeft` or `PageUp` — previous slide
- `F` — fullscreen
- `S` — presenter window with current slide, next slide, notes, and timer
- `N` — quick notes drawer
- `O` — overview
- `B` — enter or leave the Q&A backup slides
- `D` on slide 3 — open the local BukidPay demo

The presentation uses only local HTML, CSS, JavaScript, SVG, and images. The runtime files under `runtime/` come from [`html-ppt-skill`](https://github.com/lewislulu/html-ppt-skill) and are bundled locally so the deck does not require a CDN, remote font, or network request.

The topographic texture is recolored at render time through a low-opacity CSS mask; the source PNG remains unchanged.
