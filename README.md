# Brew Day

Turns an all-grain kit sheet (PDF, photo or text) into a step-by-step **brew-in-a-bag** plan, converting
Grainfather-style mash/sparge instructions into a single full-volume BIAB mash.

```sh
just install   # npm install
just dev       # http://localhost:5173
just test      # unit + component tests
just build     # type-check and production build
```

## How the water is worked out

Based on [The Malt Miller's BIAB guide](https://www.themaltmiller.co.uk/blog/all-grain-brewing-with-just-one-pot-the-biab-method/),
extended so the batch size is **clean beer into the fermenter**:

| | Default |
|---|---|
| Batch size (clean beer) | from the sheet |
| + Trub & kettle loss | 2 L |
| + Cooling shrinkage | 4% of the hot volume |
| = End of boil (hot) | |
| + Boil-off | 3 L/hr |
| = Pre-boil volume | |
| + Grain absorption | 1 L/kg |
| = **Total water** | |

If water plus grain would go over the kettle's **max safe capacity** (Equipment tab, default 32 L), the
plan switches to a BIAB sparge. It mashes with as much water as fits, then pours the rest over the lifted
bag at the sheet's sparge temperature. Strike temperature is recalculated for the thicker mash.

If you enter your kettle's inside diameter, every kettle volume is also shown as a ruler depth
(depth = volume ÷ πr², assuming straight sides and a flat base). The gravity check then accepts a depth,
and the Equipment tab suggests a boil-off rate of about 3.1 cm of depth per hour, which is 3 L/hr in a
35 cm kettle. A boil-off rate you've measured yourself is more accurate.

Strike temp uses Palmer's infusion equation plus a 0.5°C allowance (calibrated so a 66°C mash needs a 69°C strike). All of these figures can be
changed on the **Equipment** tab and are saved in the browser.

## Code map

- `src/lib/parser.ts` turns sheet text into a recipe (handles Dark Rock-style tables and hop packs, plus
  ordinary one-ingredient-per-line recipes)
- `src/lib/calculations.ts` holds the water plan, strike temp and pre-boil gravity correction
- `src/lib/sheet.ts` builds the brew sheet: volumes, temps and times, gravities and additions
- `src/lib/extract.ts` extracts text from PDFs (pdf.js) and photos (Tesseract OCR), all in the browser
