import type { Extra, ExtraStage, Fermentable, HopAddition, HopUse, MashStep, Recipe } from './types'
import { emptyRecipe } from './types'

export interface ParseResult {
  recipe: Recipe
  /** Things the parser had to guess or couldn't find; shown to the user for review. */
  warnings: string[]
}

const NUM = '(\\d+(?:\\.\\d+)?)'
const LITRES = `${NUM}\\s*(?:l\\b|ltrs?\\b|litres?|liters?)`
const TEMP = `${NUM}\\s*°?\\s*c\\b`
const MINUTES = `${NUM}\\s*(?:min|mins|minutes)\\b`

type Section = 'none' | 'malt' | 'hops' | 'yeast' | 'extras' | 'mash' | 'sparge' | 'boil' | 'ferment'

const SECTION_LABELS: [Section, RegExp][] = [
  ['malt', /^(malts?|grains?|grain bill|fermentables?|grist)\b/i],
  ['hops', /^hops?\b/i],
  ['yeast', /^yeasts?\b/i],
  ['extras', /^(extras?|other|additions|misc\w*|adjuncts|water treatment)\b/i],
  ['mash', /^mash(ing)?\b/i],
  ['sparge', /^sparg(e|ing)\b/i],
  ['boil', /^boil(ing)?\b/i],
  ['ferment', /^ferment\w*\b/i],
]

const HOP_NAMES =
  /\b(challenger|citra|nelson|sauvin|cascade|centennial|chinook|columbus|simcoe|mosaic|amarillo|galaxy|fuggles?|goldings|ekg|target|northdown|admiral|bramling|first gold|magnum|saaz|hallertau\w*|tettnang\w*|perle|willamette|styrian|bobek|motueka|riwaka|wakatu|ella|vic secret|enigma|azacca|el dorado|idaho|sabro|strata|talus|ekuanot|warrior|apollo|summit|pilgrim|progress|jester|olicana|endeavour|harlequin|ernest|minstrel|phoenix|sovereign|herkules|tradition|spalter|mittelfr\w*|hersbrucker|pacifica|pacific jade|wai-iti|waimea|rakau|green bullet|cryo|t90|lupulin)\b/i

const YEAST_NAMES =
  /\b(yeast|safale|saflager|us-?05|s-?04|s-?33|k-?97|w-?34\/70|be-?256|nottingham|windsor|verdant|london|wlp\d+|wyeast|lallemand|lalbrew|mangrove|m\d{2}|crossmyloof|fermentis|kveik|voss|lutra)\b/i

interface KnownExtra {
  match: RegExp
  stage: ExtraStage
  timeMin?: number
  note: string
}

const KNOWN_EXTRAS: KnownExtra[] = [
  { match: /\b(brite ?wort|protafloc|whirlfloc|irish moss|copper finings)\b/i, stage: 'boil', timeMin: 15, note: 'Kettle (copper) finings for clearer wort' },
  { match: /\b(pure ?brew|campden|crs|ams|gypsum|calcium chloride|water treatment|lactic acid|burton)\b/i, stage: 'water', note: 'Water treatment: add to your brewing water before heating' },
  { match: /yeast nutrient|servomyces/i, stage: 'boil', timeMin: 10, note: 'Yeast nutrient' },
  { match: /starbrite|beer finings|gelatine|kwik ?clear|isinglass|auxiliary finings|finings/i, stage: 'fermenter', note: 'Beer finings: add near the end of fermentation, before packaging' },
  { match: /priming|carbonation drops|dextrose|brewing sugar/i, stage: 'packaging', note: 'Priming sugar for bottling/kegging' },
]

function normalise(text: string) {
  return (
    text
      .replace(/\r/g, '')
      .replace(/[|¦]/g, ' ')
      .replace(/(\d),(\d)/g, '$1.$2')
      .replace(/º/g, '°')
      .replace(/[ \t]+/g, ' ')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  )
}

function toNum(s: string | undefined) {
  return s === undefined ? undefined : parseFloat(s)
}

function parseGravity(raw: string): number {
  const n = parseFloat(raw.replace(',', '.'))
  // "1043" → 1.043, "1.043" stays, "43" (points) → 1.043
  if (n > 100) return n / 1000
  if (n < 2) return n
  return 1 + n / 1000
}

function findGravity(text: string, labels: RegExp): number | undefined {
  const re = new RegExp(`(?:${labels.source})[^\\d\\n]{0,15}(1[.,]?\\d{3})`, 'i')
  const m = text.match(re)
  return m ? parseGravity(m[1]) : undefined
}

function stripLabel(segment: string) {
  return segment
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^(malts?|grains?|grain bill|fermentables?|grist|hops?|yeasts?|extras?|other|additions)\b[:\s-]*/i, '')
    .trim()
}

interface Amount {
  value: number
  unit: 'kg' | 'g'
  rest: string
}

function parseAmount(segment: string): Amount | undefined {
  const m = segment.match(/(\d+(?:\.\d+)?)\s*(kg|kilos?|g|grams?|grm|gms?)\b/i)
  if (!m) return undefined
  const unit = /^k/i.test(m[2]) ? 'kg' : 'g'
  const rest = (segment.slice(0, m.index) + ' ' + segment.slice(m.index! + m[0].length))
    .replace(/\b\d+(\.\d+)?\s*%\s*(aa|alpha)?/gi, ' ')
    .replace(/@?\s*\d+\s*(min|mins|minutes)\b/gi, ' ')
    .replace(/\b(of|x)\b/gi, ' ')
    .replace(/[-–:@,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { value: parseFloat(m[1]), unit, rest }
}

/**
 * Turn a kit's timing instruction into a hop use + time.
 * Handles "Add at the start of the boil", "after 45 minutes of the boil",
 * "at the end of the boil (Flameout) and leave for 15 minutes", "@ 60 min", "dry hop day 3"...
 */
export function parseTiming(text: string, boilTimeMin: number): { use: HopUse; time: number } | undefined {
  const t = text.toLowerCase()
  let m: RegExpMatchArray | null

  if (/dry[ -]?hop/.test(t)) {
    m = t.match(/day\s*(\d+)/) ?? t.match(/(\d+)\s*days?/)
    return { use: 'dry-hop', time: m ? parseInt(m[1]) : 3 }
  }
  if (/first[ -]?wort|\bfwh\b/.test(t)) return { use: 'first-wort', time: boilTimeMin }
  if (/whirlpool|hop ?stand|flame ?out|end of (the )?boil|steep|knock ?out/.test(t)) {
    m = t.match(/(?:leave|steep|stand|rest)\w*\s*(?:for\s*)?(\d+)\s*min/) ?? t.match(/(\d+)\s*min/)
    return { use: 'whirlpool', time: m ? parseInt(m[1]) : 0 }
  }
  if (/(start|beginning) of (the )?boil|at the boil|when (the )?boil/.test(t)) return { use: 'boil', time: boilTimeMin }
  if ((m = t.match(/after\s*(\d+)\s*min\w*\s*(?:of|into)\s*(?:the\s*)?boil/))) {
    return { use: 'boil', time: Math.max(boilTimeMin - parseInt(m[1]), 0) }
  }
  if ((m = t.match(/(\d+)\s*min\w*\s*(?:before|from)\s*(?:the\s*)?end/)) || (m = t.match(/(\d+)\s*min\w*\s*(?:remaining|left|to go)/))) {
    return { use: 'boil', time: parseInt(m[1]) }
  }
  if ((m = t.match(/@\s*(\d+)/)) || (m = t.match(/(\d+)\s*min/))) {
    return { use: 'boil', time: parseInt(m[1]) }
  }
  return undefined
}

function classifyExtra(name: string): Extra {
  const known = KNOWN_EXTRAS.find((k) => k.match.test(name))
  return known
    ? { name, stage: known.stage, timeMin: known.timeMin, note: known.note }
    : { name, stage: 'other' }
}

/** Value under a table header, e.g. "MASH WATER  MASH TEMPERATURE" followed by "14.5 litres  66C". */
function valueNear(lines: string[], i: number, re: RegExp): RegExpMatchArray | null {
  return lines[i].match(re) ?? (lines[i + 1] ? lines[i + 1].match(re) : null)
}

export function parseRecipeText(text: string): ParseResult {
  const lines = normalise(text)
  const all = lines.join('\n')
  const recipe = emptyRecipe()
  const warnings: string[] = []

  // --- Name
  const titleLine =
    lines.find((l) => /\b(instructions|recipe)\b/i.test(l) && l.length < 90) ??
    lines.find((l) => /[a-z]/i.test(l) && l.length > 3 && l.length < 60)
  if (titleLine) {
    recipe.name = titleLine
      .replace(/\([^)]*\)/g, '')
      .replace(/\b(all[ -]?grain|instructions|recipe|kit)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // --- Gravities
  const og = findGravity(all, /original gravity|starting gravity|target og|\bo\.?g\.?\b/)
  const fg = findGravity(all, /final gravity|finishing gravity|terminal gravity|target fg|\bf\.?g\.?\b/)
  if (og) recipe.og = og
  else warnings.push('Original gravity not found; please enter it.')
  if (fg) recipe.fg = fg
  else warnings.push('Final gravity not found; please enter it.')

  // --- Summary stats
  const abv = all.match(/(\d+(?:\.\d+)?)\s*%\s*(?:abv)?/i)
  const abvLine = lines.findIndex((l) => /\babv\b/i.test(l))
  if (abvLine >= 0) {
    const m = valueNear(lines, abvLine, /(\d+(?:\.\d+)?)\s*%/)
    if (m) recipe.abv = parseFloat(m[1])
  } else if (abv) recipe.abv = parseFloat(abv[1])
  const ibu = all.match(/(\d+(?:\.\d+)?)\s*ibu/i)
  if (ibu) recipe.ibu = parseFloat(ibu[1])
  const ebc = all.match(/(\d+(?:\.\d+)?)\s*ebc/i)
  if (ebc) recipe.colourEbc = parseFloat(ebc[1])

  // --- Batch size
  let batch: number | undefined
  lines.forEach((l, i) => {
    if (batch !== undefined) return
    if (/\b(makes|batch size|batch volume|brew length|yield|into fermenter|final volume)\b/i.test(l)) {
      const m = valueNear(lines, i, new RegExp(LITRES, 'i'))
      if (m) batch = parseFloat(m[1])
      else {
        const gal = valueNear(lines, i, /(\d+(?:\.\d+)?)\s*(?:us\s*)?gal/i)
        if (gal) batch = round1(parseFloat(gal[1]) * 3.785)
      }
    }
  })
  if (batch === undefined) {
    const pints = all.match(/(\d+)\s*pints/i)
    if (pints) batch = round1(parseInt(pints[1]) * 0.568)
  }
  if (batch !== undefined) recipe.batchSizeL = batch
  else warnings.push('Batch size not found; defaulted to 23 L.')

  // --- Boil time
  const boil = all.match(new RegExp(`boil(?:ing)?\\s*(?:time)?[^\\d\\n]{0,15}${MINUTES}`, 'i'))
  if (boil) recipe.boilTimeMin = parseFloat(boil[1])

  // --- Mash, sparge (from table headers or inline)
  const mashSteps: MashStep[] = []
  lines.forEach((l, i) => {
    if (/mash water/i.test(l)) {
      const w = valueNear(lines, i, new RegExp(LITRES, 'i'))
      if (w) recipe.sheetMashWaterL = parseFloat(w[1])
    }
    if (/sparge water( amount)?|sparge volume/i.test(l)) {
      const w = valueNear(lines, i, new RegExp(LITRES, 'i'))
      if (w) recipe.sheetSpargeWaterL = parseFloat(w[1])
    }
    if (/sparge temp/i.test(l)) {
      const t = valueNear(lines, i, /(\d{2}(?:\.\d)?(?:\s*-\s*\d{2}(?:\.\d)?)?)\s*°?\s*c\b/i)
      if (t) recipe.sheetSpargeTempC = t[1].replace(/\s/g, '')
    }
    if (/mash temp|mash time|mash step|saccharification|protein rest|mash ?out|beta|alpha rest/i.test(l) || /^mash\b/i.test(l)) {
      const temp = valueNear(lines, i, new RegExp(TEMP, 'i'))
      const time = valueNear(lines, i, new RegExp(MINUTES, 'i'))
      if (temp && time) {
        const tempC = parseFloat(temp[1])
        const step: MashStep = {
          name: /out/i.test(l) || tempC >= 74 ? 'Mash out' : mashSteps.length ? `Mash step ${mashSteps.length + 1}` : 'Mash',
          tempC,
          timeMin: parseFloat(time[1]),
        }
        if (!mashSteps.some((s) => s.tempC === step.tempC && s.timeMin === step.timeMin)) mashSteps.push(step)
      }
    }
  })
  if (mashSteps.length) recipe.mashSteps = mashSteps
  else warnings.push('Mash temperature/time not found; defaulted to 66°C for 60 minutes.')

  // --- Ingredients (label-in-line rows like "HOPS 15g Challenger, 30g Citra" or sectioned lists)
  const fermentables: Fermentable[] = []
  const hops: HopAddition[] = []
  const extras: Extra[] = []
  const extraPacks = new Map<number, string>()
  let section: Section = 'none'

  for (const line of lines) {
    const label = SECTION_LABELS.find(([, re]) => re.test(line))
    if (label) section = label[0]
    // Long prose lines aren't ingredient rows.
    if (line.length > 120 || /\b(we|you|your|our)\b/i.test(line)) continue
    if (/^(mash|sparge|boil)\b/i.test(line) && !label) continue
    if (/^pack\s*[a-z]\b/i.test(line)) continue

    if (section === 'yeast') {
      const name = stripLabel(line)
      if (name) {
        if (!recipe.yeast.name) recipe.yeast.name = name
        section = 'none'
      }
      continue
    }

    if (section === 'extras') {
      const body = stripLabelKeepParens(line)
      for (const seg of body.split(/,|;/).map((s) => s.trim()).filter(Boolean)) {
        const pack = seg.match(/\(?\s*in\s*pack\s*([a-z])\s*\)?/i)
        const name = seg.replace(/\(?\s*in\s*pack\s*[a-z]\s*\)?/i, '').trim()
        if (!name) continue
        if (pack) extraPacks.set(extras.length, pack[1].toUpperCase())
        extras.push(classifyExtra(name))
      }
      if (label) section = 'none'
      continue
    }

    if (section === 'malt' || section === 'hops') {
      const body = stripLabel(line)
      for (const seg of body.split(/,|;/).map((s) => s.trim()).filter(Boolean)) {
        const amt = parseAmount(seg)
        if (!amt || !amt.rest) continue
        const isHop = section === 'hops' || HOP_NAMES.test(seg)
        if (isHop) {
          const timing = parseTiming(seg, recipe.boilTimeMin)
          hops.push({
            name: amt.rest,
            grams: amt.unit === 'kg' ? amt.value * 1000 : amt.value,
            use: timing?.use ?? 'boil',
            time: timing?.time ?? -1,
          })
        } else {
          fermentables.push({ name: amt.rest, amountKg: amt.unit === 'kg' ? amt.value : amt.value / 1000 })
        }
      }
      // A one-line labelled row (e.g. "MALT (4.15kg) ...") ends the section.
      if (label && body) section = 'none'
      continue
    }

    if (!label && YEAST_NAMES.test(line) && !recipe.yeast.name && line.length < 60) {
      recipe.yeast.name = line
    }
  }

  // --- Kit packs: "PACK B (30g) Add after 45 minutes of the boil"
  const packs: { letter: string; grams?: number; timing?: { use: HopUse; time: number } }[] = []
  for (const line of lines) {
    const m = line.match(/^pack\s*([a-z])\b\s*(?:\(?\s*(\d+(?:\.\d+)?)\s*g\s*\)?)?\s*(.*)$/i)
    if (m) packs.push({ letter: m[1].toUpperCase(), grams: toNum(m[2]), timing: parseTiming(m[3], recipe.boilTimeMin) })
  }
  if (packs.length) {
    const unassigned = [...hops]
    for (const pack of packs) {
      let idx = unassigned.findIndex((h) => pack.grams !== undefined && h.grams === pack.grams)
      if (idx < 0) idx = unassigned.length ? 0 : -1
      if (idx < 0) continue
      const hop = unassigned.splice(idx, 1)[0]
      hop.pack = `Pack ${pack.letter}`
      if (pack.timing) {
        hop.use = pack.timing.use
        hop.time = pack.timing.time
      }
    }
    const ambiguous = packs.filter((p) => packs.filter((q) => q.grams === p.grams).length > 1)
    if (ambiguous.length) {
      warnings.push(
        `Packs ${ambiguous.map((p) => p.letter).join(' & ')} weigh the same, so hops were matched in the order listed; check the labels on your hop packets.`,
      )
    }
    extraPacks.forEach((letter, i) => {
      const pack = packs.find((p) => p.letter === letter)
      if (pack?.timing) {
        extras[i].stage = pack.timing.use === 'whirlpool' ? 'flameout' : 'boil'
        extras[i].timeMin = pack.timing.use === 'whirlpool' ? 0 : pack.timing.time
        extras[i].note = `${extras[i].note ? extras[i].note + '. ' : ''}Packed with hop pack ${letter}`
      }
    })
  }

  for (const hop of hops) {
    if (hop.time < 0) {
      hop.time = recipe.boilTimeMin
      warnings.push(`No timing found for ${hop.name}; assumed start of boil.`)
    }
  }

  // --- Fermentation temperature
  const fermTemp = all.match(/ferment\w*[^\n\d]{0,30}(\d{2}(?:\.\d)?)\s*(?:-\s*\d{2}\s*)?°?\s*c\b/i)
  if (fermTemp) recipe.yeast.tempC = parseFloat(fermTemp[1])

  recipe.fermentables = fermentables
  recipe.hops = hops
  recipe.extras = extras
  if (!fermentables.length) warnings.push('No malts found; please add your grain bill.')
  if (!hops.length) warnings.push('No hops found; please add your hop schedule.')

  return { recipe, warnings }
}

function stripLabelKeepParens(line: string) {
  return line.replace(/^(extras?|other|additions|misc\w*|adjuncts|water treatment)\b[:\s-]*/i, '').trim()
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}
