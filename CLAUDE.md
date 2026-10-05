# Brew Day

A Vue 3 + Vite + TypeScript app that turns an all-grain kit instruction sheet (PDF, photo or text) into a
**brew-in-a-bag (BIAB) brew sheet**: one page with the volumes, temperatures, times, gravities and additions
needed on brew day. Everything runs in the browser. There is no backend.

## Who it's for and what they want

- A UK homebrewer who buys all-grain kits (e.g. **Dark Rock**). The kit sheets are written for the
  **Grainfather** (mash water + sparge water), but the user brews **BIAB in a single kettle**, so the app
  converts to full-volume BIAB (or BIAB + sparge when the kettle is too small).
- Metric only (litres, kg, g, °C), with gravity shown as 1.043.
- **The output is a reference sheet, not a step-by-step guide.** The user explicitly asked to remove:
  step-by-step instructions, prose/explanatory text, a "Prepare" section, sanitisation and packaging advice,
  "lift and drain the bag" steps, checkboxes/progress, and countdown timers. Keep the brew sheet terse:
  numbers and timings only. Don't reintroduce these without being asked.
- The user cares about layout polish: even card heights, consistent input heights and enough spacing.
- Real-world calibration from the user: **a 69°C strike settles at a 66°C mash**. The default strike allowance
  (0.5°C) is tuned to reproduce this for a typical 23 L / ~4 kg full-volume brew.

## Commands

```sh
just dev     # vite dev server on http://localhost:5173
just test    # vitest (unit + component tests, jsdom)
just lint    # vue-tsc type-check
just build   # type-check + production build
```

- TypeScript is pinned to `~5.9`: TypeScript 7 breaks `vue-tsc` (`ERR_PACKAGE_PATH_NOT_EXPORTED`).
- Git repo: https://github.com/samhannan/brew-day (branch `main`).

## Layout

```
src/
  App.vue                 tabs: 1. Upload · 2. Check recipe · 3. Brew sheet · Equipment
  store.ts                reactive state persisted to localStorage key `brew-day:v1`
  lib/
    types.ts              Recipe, Equipment, DEFAULT_EQUIPMENT, emptyRecipe()
    calculations.ts       waterPlan(), strikeTemp(), gravityCorrection(), depth/boil-off helpers
    sheet.ts              buildBrewSheet(): volumes / temps / gravity / additions rows for the UI
    parser.ts             parseRecipeText(): kit sheet text → Recipe + warnings
    extract.ts            PDF text (pdfjs-dist) and photo OCR (tesseract.js), both lazy-loaded
    sample.ts             DARK_ROCK_SAMPLE: OCR-style text of a real Dark Rock sheet (used in tests + demo button)
  components/
    ImportPanel.vue       file upload / drag-drop / paste / Dark Rock example / blank recipe
    RecipeEditor.vue      editable recipe (malts, hops with pack + timing, mash steps, yeast, extras)
    BrewSheet.vue         2×2 equal-height cards: Volumes (+ water breakdown), Temps & times, Gravity, Additions
    GravityCheck.vue      pre-boil reading → predicted OG + fix (dilute / DME / longer boil)
    EquipmentPanel.vue    3 rows × 4 columns: Kettle, Losses, Mash
```

Tests sit next to the code (`*.test.ts`). The Dark Rock sample is the main fixture.

## Water model (`calculations.ts`)

Based on The Malt Miller's BIAB guide (their site blocks automated fetches; the user pasted the text):
**total water = batch + boil-off (3 L/hr) + grain absorption (1 L/kg)**, strike ~70–74°C, mash ~65–68°C
for 60 min, drain the bag without squeezing. Their worked example (20 L, 5 kg, 1 hr → 28 L) is a test.

The app extends this, because **batch size means clean beer into the fermenter** (the user's requirement):

```
post-boil cold = batch + trub/kettle loss (default 2 L)
post-boil hot  = post-boil cold / (1 − cooling shrinkage, default 4%)
pre-boil       = post-boil hot + boil-off rate × boil hours
total water    = pre-boil + grain kg × absorption
```

- Kettle volumes (pre-boil and end of boil) are **hot**; batch size and OG are **cold**.
- **Sparge mode:** if `total water + grain × displacement (0.67 L/kg)` > `min(maxCapacityL, kettleVolumeL)`,
  mash water = capacity − grain displacement and the rest is sparge water, poured over the lifted bag at
  the sheet's sparge temp (default 76–77°C). Warnings appear for a mash thicker than 2.5 L/kg and for a
  pre-boil volume over capacity. If the mash water and pre-boil volume come out equal, that's a coincidence:
  the sparge happens to equal what the grain absorbs.
- **Strike temp:** Palmer's infusion equation `(0.41 / ratio) × (mash − grain temp) + mash`, using the
  *mash* water ratio, plus `strikeAllowanceC` (0.5°C).
- **Pre-boil gravity:** sugar is conserved, so `OG points × post-boil hot / pre-boil`.
- **Gravity correction:** works in cold-equivalent volumes. DME is 367 points·L/kg (44 ppg).
- **Kettle diameter** (optional, 0 = off) gives ruler depths (`volume ÷ πr²`, flat base assumed) and a
  suggested boil-off of 31 L/hr per m² of surface (≈3 L/hr for a 35 cm kettle). The user's measured
  boil-off always wins; the suggestion only applies via the "Use" button.

## Parser notes (`parser.ts`)

Heuristic and regex-based, and tuned against the Dark Rock layout. Everything is editable on the
Check recipe tab, so parsing can be best-effort but should emit `warnings` when it guesses.

- **Table headers on one line, values on the next**, e.g. `MASH WATER MASH TEMPERATURE MASH TIME` /
  `14.5 litres 66C 60 minutes`. `valueNear()` checks the label line, then the next line.
- **Labelled comma lists:** `MALT (4.15kg) 3.9Kg Best Ale, 250g Torrefied Wheat`,
  `HOPS 15g Challenger, 30g Citra, 30g Nelson Sauvin`.
- **Hop packs:** `PACK B (30g) Add after 45 minutes of the boil`. Packs are matched to hops by weight, then
  by list order, with a warning when weights tie. `parseTiming()` turns phrases like "start of the boil",
  "after N minutes of the boil", "Flameout and leave for 15 minutes", "@ 60 min" or "dry hop day 3" into
  `{ use, time }`. Boil `time` = minutes remaining; whirlpool `time` = steep minutes; dry-hop `time` = day.
- **Extras** are classified by name (Brite Wort → boil 15 min, Pure Brew → water, Starbrite → fermenter),
  and `(in pack B)` takes that pack's timing.
- Gravities: `1043`, `1.043` and `43` all parse to 1.043. Gallons and pints convert to litres.
- The sheet's Grainfather mash/sparge volumes are kept on the recipe (`sheetMashWaterL` etc.) for reference
  only and shown as "not used" in the water breakdown.

## Gotchas

- `localStorage` keeps the user's saved `equipment`. Changing a value in `DEFAULT_EQUIPMENT` does **not**
  update an existing user's saved setting, so tell them to change it on the Equipment tab.
- Scoped-style specificity: `main` also carries `.wrap`, whose `padding` shorthand beats a bare `main {}`
  rule. Use `main.wrap` for page padding.
- The brew sheet grid uses `grid-auto-rows: 1fr`, so all four cards match the tallest. Opening the water
  breakdown in Volumes grows every card.
- Photo OCR downloads Tesseract's English data from a CDN on first use. OCR of creased paper is imperfect,
  which is why the Check recipe step exists. A possible future upgrade is using Claude vision to read photos
  (needs an API key).

## Style

- Design tokens live in `src/style.css` `:root`, with a dark mode via `prefers-color-scheme`. The palette is
  warm cream/amber with a hop-green accent. Fonts: Fraunces (headings), IBM Plex Sans (body),
  IBM Plex Mono (numbers).
- Match the existing code: `<script setup lang="ts">`, scoped styles, sparse comments that explain *why*.
