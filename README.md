# ASTB-E Prep

**An adaptive study PWA for math, reading, mechanics, and aviation/nautical knowledge.**

[Live app](https://sunghyunc.github.io/astb-prep/) · [한국어 사용 안내](README.ko.md) · [Related: AFOQT Master](https://github.com/SungHyunC/afoqt-vocab)

A static JavaScript application combining timed practice, SVG diagrams, mistake review, and progress tracking. English questions include Korean explanations. No frontend framework or package-install step is required.

## Engineering highlights

- **Adaptive selection:** a three-parameter logistic item-response model, EAP ability estimation, topic balancing, and exposure penalties in [`js/cat.js`](js/cat.js).
- **Resumable exams:** section timers, answer locking, local snapshots, and screen wake-lock support in [`js/exam.js`](js/exam.js).
- **Visual questions:** SVG renderers for mechanics and aviation diagrams in [`js/figures.js`](js/figures.js).
- **Practice workflows:** topic drills, mistake-reason logs, fixed-form mocks, and SM-2 terminology cards.
- **Content tooling:** schema, duplicate, and distribution checks, followed by a source-to-runtime JSON build.
- **Offline and sync:** a service worker and local storage, with optional Supabase sync. Writes are batched; larger progress records are pulled on foreground use instead of continuously subscribed to Realtime updates.

> The adaptive engine uses author-assigned difficulty and fixed model parameters, not empirically calibrated exam items. OAR estimates are study feedback, not official scores or a validated reproduction of the ASTB-E.

## Run locally

Requirements: **Python 3** for the server; **Node.js 18+** for content tooling.

```bash
git clone https://github.com/SungHyunC/astb-prep.git
cd astb-prep
```

For a local-only run, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to empty strings in [`config.js`](config.js). Use a fresh browser profile or remove saved Supabase overrides in settings; saved values take precedence. The checked-in configuration connects to the existing demo service.

```bash
python3 scripts/devserver.py
```

Open <http://localhost:8765>. The development server disables HTTP caching and listens on all interfaces; use it on a trusted local network. Offline use requires an initial asset load.

## Validate and update content

```bash
node scripts/validate.mjs
node scripts/stats.mjs
```

Edit source batches in `content/`, following [`content/AUTHORING.md`](content/AUTHORING.md). After validation, rebuild runtime data:

```bash
node scripts/build_data.mjs
```

The build writes `data/`, including a generated timestamp in `data/meta.json`. For content releases, update the cache version in `sw.js` and app version in `js/core.js`.

The validator checks structure and distributions. It does not establish psychometric validity or verify every explanation's accuracy.

## Architecture

| Layer | Files | Responsibility |
| --- | --- | --- |
| State | `js/core.js` | Local state, mistake review, and terminology scheduling |
| Content | `js/data.js`, `content/`, `data/` | Question indexing, source batches, and runtime datasets |
| Assessment | `js/cat.js`, `js/exam.js`, `js/score.js` | Item selection, exam lifecycle, and study-score estimates |
| Interface | `js/views.js`, `js/figures.js`, `app.css` | Screens, SVG questions, and styling |
| Sync | `js/sync.js`, `supabase/schema.sql` | Initial pull, queued writes, retries, and merge rules |
| Delivery | `js/boot.js`, `sw.js`, `manifest.webmanifest` | Startup, caching, and installation |

## Optional Supabase setup

Use your own project, review and apply [`supabase/schema.sql`](supabase/schema.sql), then set the URL and public client key in `config.js`. The `astb_` prefix separates these tables from AFOQT Master. A shared sync code selects the same progress records on another device.

**Current limitation:** the supplied anonymous RLS policies allow broad access. A sync code is a client-side selector, not authenticated database authorization. A shared deployment needs Supabase Auth and owner-scoped policies. Never place a service-role key in frontend code.

## Project scope

This is an unofficial personal study app. It provides academic-section practice and guidance for other ASTB-E components; it does not implement a validated PBM simulator. Detailed answers and adaptive paths stay on the device; summary history can synchronize. Exam formats and readiness thresholds are study assumptions, not guarantees of test-day behavior or selection outcomes.
