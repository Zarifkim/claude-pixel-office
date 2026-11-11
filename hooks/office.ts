// Draws the office as one SVG document in the isometric style of
// W17ant/Claude-Office: its room with the desks and furniture baked in, its
// character sprites at its desk spots, and its effect icons. Coordinates are
// that project's stage: 754 x 566, a sprite placed by its bottom-centre.
// Animation is SMIL only (the desktop draws the SVG with no script).
import type { Worker } from '../types'
import { IMG } from './sprites.gen'
import type { Img } from './sprites.gen'

export const WALK_MS = 2400
const SW = 754
const SH = 566
const LIMIT = 128_000 // an Svg's source holds at most 131072 characters
const DOOR = { x: 67.5, y: 48.9 }
const CHAR_H = 78

type Facing = 'front-left' | 'front-right' | 'rear-left' | 'rear-right'
type Spot = { id: string; x: number; y: number; facing: Facing }

// Claude takes the first spot; the rest fill in order, desks before the
// coffee machine, water cooler and printer.
const SPOTS: Spot[] = [
  { id: 'spot-9', x: 55.2, y: 66.8, facing: 'front-left' },
  { id: 'spot-10', x: 68.7, y: 66.2, facing: 'front-right' },
  { id: 'spot-3', x: 26.9, y: 59.2, facing: 'front-left' },
  { id: 'spot-6', x: 38.8, y: 43.6, facing: 'front-left' },
  { id: 'spot-1', x: 25.8, y: 71, facing: 'rear-left' },
  { id: 'spot-2', x: 37.9, y: 68.2, facing: 'rear-right' },
  { id: 'spot-4', x: 38.5, y: 55.2, facing: 'rear-left' },
  { id: 'spot-5', x: 48.9, y: 52.9, facing: 'rear-right' },
  { id: 'spot-7', x: 52.7, y: 78.8, facing: 'rear-left' },
  { id: 'spot-8', x: 65.9, y: 75.8, facing: 'rear-right' },
  { id: 'spot-water-1', x: 53.3, y: 46.6, facing: 'rear-left' },
  { id: 'spot-water-2', x: 56, y: 47.7, facing: 'front-right' },
  { id: 'spot-coffee-1', x: 73.5, y: 56.7, facing: 'rear-left' },
  { id: 'spot-coffee-2', x: 76.2, y: 58.4, facing: 'front-right' },
  { id: 'spot-printer', x: 81, y: 63, facing: 'rear-left' },
  { id: 'spot-filing', x: 47.8, y: 57.6, facing: 'front-right' },
]
export const SPOT_COUNT = SPOTS.length

// Claude-Office's own table of agent types to characters (src/config.ts).
const ROLE_TO_CHAR: Record<string, string> = {
  debugger: 'dev-1',
  'code-reviewer': 'employee-1',
  'frontend-developer': 'Frontend-dev-1',
  'fullstack-developer': 'dev-2',
  'test-engineer': 'employee-2',
  'security-auditor': 'security-audit-1',
  'devops-engineer': 'employee-3',
  'architect-reviewer': 'employee-1',
  'performance-engineer': 'employee-2',
  'database-architect': 'employee-3',
  'typescript-pro': 'employee-1',
  'ai-engineer': 'dev-2',
  'prompt-engineer': 'dev-2',
  'general-purpose': 'employee-3',
  Explore: 'explore-1',
  Plan: 'dev-2',
}
const CAST = ['dev-1', 'dev-2', 'employee-1', 'employee-2', 'employee-3', 'explore-1', 'security-audit-1', 'Frontend-dev-1']
const COLORS = ['#38bdf8', '#f97316', '#a78bfa', '#34d399', '#f472b6', '#facc15', '#60a5fa', '#fb7185']
const CLAUDE_COLOR = '#d97757'

export function characterOf(w: Pick<Worker, 'role' | 'type' | 'look'>): string {
  if (w.role === 'main') return 'Claude-1'
  const t = w.type.includes(':') ? w.type.split(':').pop()! : w.type
  return ROLE_TO_CHAR[t] ?? CAST[Math.abs(w.look) % CAST.length] ?? CAST[0]
}

function colorOf(w: Worker): string {
  return w.role === 'main' ? CLAUDE_COLOR : COLORS[(Math.abs(w.look) >>> 4) % COLORS.length] ?? COLORS[0]
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
}

function px(spot: { x: number; y: number }): { x: number; y: number } {
  return { x: (spot.x / 100) * SW, y: (spot.y / 100) * SH }
}

function image(img: Img, x: number, y: number, extra = ''): string {
  return `<image href="${img.data}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${img.w}" height="${img.h}"${extra}/>`
}

// A sprite standing with its bottom-centre at (x, y); mirrored when `flip`.
function standing(img: Img, x: number, y: number, flip = false): string {
  if (!flip) return image(img, x - img.w / 2, y - img.h)
  return `<g transform="translate(${(x * 2).toFixed(1)} 0) scale(-1 1)">${image(img, x - img.w / 2, y - img.h)}</g>`
}

function stillOf(char: string, facing: Facing): Img {
  return IMG[`${char}/${facing}`] ?? IMG[`Claude-1/${facing}`]
}

function shadow(x: number, y: number): string {
  return `<ellipse cx="${x.toFixed(1)}" cy="${(y - 1).toFixed(1)}" rx="13" ry="4" fill="#000" opacity="0.22"/>`
}

function label(cx: number, bottom: number, text: string, bg: string, fg: string, border: string): string {
  const w = text.length * 5.6 + 12
  const x = Math.max(2, Math.min(SW - w - 2, cx - w / 2))
  const y = bottom - 15
  return (
    `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="14" rx="4" fill="${bg}" stroke="${border}" stroke-width="1.2"/>` +
    `<path d="M${(cx - 4).toFixed(1)} ${y + 13.4} l4 4 l4 -4 z" fill="${bg}" stroke="${border}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<rect x="${(cx - 4.5).toFixed(1)}" y="${y + 12}" width="9" height="2" fill="${bg}"/>` +
    `<text x="${(x + w / 2).toFixed(1)}" y="${y + 10.2}" font-size="9.5" font-family="ui-monospace,Menlo,Consolas,monospace" font-weight="700" text-anchor="middle" fill="${fg}">${esc(text)}</text>`
  )
}

function nameTag(cx: number, y: number, name: string, color: string): string {
  const text = name.length > 16 ? name.slice(0, 15) + '…' : name
  const w = text.length * 5 + 10
  return (
    `<rect x="${(cx - w / 2).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="11" rx="5.5" fill="#0f172a" fill-opacity="0.82" stroke="${color}" stroke-width="1.2"/>` +
    `<text x="${cx.toFixed(1)}" y="${y + 8.2}" font-size="8" font-family="ui-sans-serif,system-ui,sans-serif" font-weight="700" text-anchor="middle" fill="#f8fafc">${esc(text)}</text>`
  )
}

// What floats over a worker's head: a speech bubble, the "needs you" card,
// thinking dots, and one of Claude-Office's effect icons.
function overhead(w: Worker, cx: number, headTop: number, isSelected: boolean): string {
  // A box over the body that takes the hover, so the name shows on hover.
  let out = `<rect x="${(cx - 16).toFixed(1)}" y="${headTop.toFixed(1)}" width="32" height="${CHAR_H}" fill="#000" fill-opacity="0" pointer-events="all"/>`
  const fx = (name: string) => {
    const img = IMG[`fx/${name}`]
    if (!img) return ''
    return `<g>${image(img, cx + 11, headTop + 2)}<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="1.6s" repeatCount="indefinite"/></g>`
  }
  const tagTop = headTop - 14
  out += `<g class="${isSelected ? '' : 'n'}">${nameTag(cx, tagTop, w.name, colorOf(w))}</g>`
  const bubbleBottom = isSelected ? tagTop - 3 : headTop - 2
  switch (w.status) {
    case 'waiting':
      out += `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="0.8s" repeatCount="indefinite"/>${label(cx, bubbleBottom, `⚠ needs you${w.tool ? ': ' + w.tool : ''}`, '#facc15', '#1c1917', '#78350f')}</g>`
      break
    case 'leaving':
      out += label(cx, bubbleBottom, 'done ✓', '#dcfce7', '#14532d', '#166534') + fx('thumb-up')
      break
    case 'idle':
      out += fx('sleeping')
      break
    case 'thinking': {
      out += `<rect x="${cx - 14}" y="${bubbleBottom - 14}" width="28" height="12" rx="6" fill="#fff" stroke="#334155" stroke-width="1.2"/>`
      for (let i = 0; i < 3; i++) {
        out += `<circle cx="${cx - 7 + i * 7}" cy="${bubbleBottom - 8}" r="2" fill="#475569"><animate attributeName="opacity" values="0.2;1;0.2" dur="1s" begin="${i * 0.22}s" repeatCount="indefinite"/></circle>`
      }
      break
    }
    default: {
      const text = (w.tool + (w.detail ? ' ' + w.detail : '')).trim()
      if (text) out += label(cx, bubbleBottom, text.length > 26 ? text.slice(0, 25) + '…' : text, '#ffffff', '#0f172a', '#334155')
      if (w.status === 'typing' || w.status === 'terminal') out += fx('typing')
      else if (w.status === 'delegating' || w.status === 'browsing') out += fx('star')
    }
  }
  return out
}

// A walk between the door and a spot: Claude-Office's four-frame walk cycle,
// moved along the line and hidden when it arrives.
function walker(char: string, from: { x: number; y: number }, to: { x: number; y: number }, durS: number, frames: boolean, title: string): string {
  const goingUp = to.y < from.y
  const flip = to.x > from.x
  const view = goingUp ? 'rear-left' : 'front-left'
  let body = ''
  const walkImgs = [1, 2, 3, 4].map(n => IMG[`${char}/${view}-walk${n}`]).filter(Boolean)
  if (frames && walkImgs.length === 4) {
    walkImgs.forEach((img, i) => {
      const values = [0, 1, 2, 3].map(k => (k === i ? 1 : 0)).join(';')
      body += `<g opacity="${i === 0 ? 1 : 0}">${standing(img, 0, 0, flip)}<animate attributeName="opacity" values="${values}" dur="0.56s" repeatCount="indefinite" calcMode="discrete"/></g>`
    })
  } else {
    const still = stillOf(char, (goingUp ? 'rear-' : 'front-') + (flip ? 'right' : 'left') as Facing)
    body += `<g>${standing(still, 0, 0)}<animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur="0.32s" repeatCount="indefinite"/></g>`
  }
  return (
    `<g>${title}<animateTransform attributeName="transform" type="translate" from="${from.x.toFixed(1)} ${from.y.toFixed(1)}" to="${to.x.toFixed(1)} ${to.y.toFixed(1)}" dur="${durS.toFixed(2)}s" fill="freeze"/>` +
    `<ellipse cx="0" cy="-1" rx="13" ry="4" fill="#000" opacity="0.22"/>${body}` +
    `<set attributeName="visibility" to="hidden" begin="${durS.toFixed(2)}s"/></g>`
  )
}

export type DrawOptions = { now: number; selected: string; isNight: boolean }
type Detail = { walkFrames: boolean; overlays: boolean }

function compose(workers: Worker[], opts: DrawOptions, detail: Detail): string {
  const bg = IMG[opts.isNight ? 'bg-night' : 'bg-day']
  let scene = `<image href="${bg.data}" x="0" y="0" width="${SW}" height="${SH}"/>`
  let walkers = ''
  let tops = ''

  const placed = workers
    .map(w => ({ w, spot: SPOTS[Math.abs(w.desk) % SPOTS.length] }))
    .sort((a, b) => a.spot.y - b.spot.y)

  for (const { w, spot } of placed) {
    const char = characterOf(w)
    const at = px(spot)
    const color = colorOf(w)
    const title = `<title>${esc(`${w.name} — ${statusWords(w)}`)}</title>`
    const arriving = w.role === 'subagent' && w.status !== 'leaving' && opts.now - w.arrivedAt < WALK_MS
    const leaving = w.status === 'leaving'
    const walkedFor = leaving ? opts.now - w.leftAt : opts.now - w.arrivedAt
    const remaining = Math.max(0.05, (WALK_MS - walkedFor) / 1000)
    const door = px(DOOR)

    if (arriving || (leaving && walkedFor < WALK_MS)) {
      const p = Math.min(1, walkedFor / WALK_MS)
      const from = arriving ? { x: door.x + (at.x - door.x) * p, y: door.y + (at.y - door.y) * p } : { x: at.x + (door.x - at.x) * p, y: at.y + (door.y - at.y) * p }
      walkers += walker(char, from, arriving ? at : door, remaining, detail.walkFrames, title)
    }
    if (leaving) continue

    // Seen only once the walk-in is over.
    const hidden = arriving ? ` visibility="hidden"` : ''
    const show = arriving ? `<set attributeName="visibility" to="visible" begin="${remaining.toFixed(2)}s"/>` : ''
    const still = stillOf(char, spot.facing)
    const busy = w.status !== 'idle' && w.status !== 'waiting'
    const bob = busy
      ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -1.2;0 0" dur="${w.status === 'typing' || w.status === 'terminal' ? '0.5' : '1.4'}s" repeatCount="indefinite"/>`
      : `<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.8;0 0" dur="3.2s" repeatCount="indefinite"/>`
    const ring =
      w.id === opts.selected
        ? `<ellipse cx="${at.x.toFixed(1)}" cy="${(at.y - 1).toFixed(1)}" rx="17" ry="6" fill="none" stroke="#facc15" stroke-width="2" stroke-dasharray="4 3"><animate attributeName="stroke-dashoffset" values="0;14" dur="1s" repeatCount="indefinite"/></ellipse>`
        : ''
    // A thin outline in the worker's colour, as Claude-Office draws its people.
    scene += `<g${hidden}>${show}${title}${ring}${shadow(at.x, at.y)}<g>${bob}<g filter="url(#edge-${hashColor(color)})">${standing(still, at.x, at.y)}</g></g></g>`
    const over = IMG[`over-${spot.id}`]
    if (detail.overlays && over && over.x !== undefined && over.y !== undefined) scene += image(over, over.x, over.y)
    tops += `<g class="w"${hidden}>${show}${overhead(w, at.x, at.y - CHAR_H, w.id === opts.selected)}</g>`
  }

  const colors = [...new Set(workers.map(colorOf))]
  const filters = colors
    .map(
      c =>
        `<filter id="edge-${hashColor(c)}" x="-20%" y="-10%" width="140%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1" result="d"/><feFlood flood-color="${c}" flood-opacity="0.8"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    )
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW}" height="${SH}" style="background:#0f1424">` +
    `<style>.n{opacity:0;transition:opacity .15s}.w:hover .n{opacity:1}.w:hover{cursor:default}</style>` +
    `<defs>${filters}</defs>` +
    scene +
    walkers +
    tops +
    `</svg>`
  )
}

function hashColor(c: string): string {
  return c.replace('#', '')
}

export function drawOffice(workers: Worker[], opts: DrawOptions): { svg: string } {
  // Walk cycles and desk overlays are the heavy parts; they give way first.
  for (const detail of [
    { walkFrames: true, overlays: true },
    { walkFrames: false, overlays: true },
    { walkFrames: false, overlays: false },
  ]) {
    const svg = compose(workers, opts, detail)
    if (svg.length <= LIMIT) return { svg }
  }
  // Still too much: show the busiest first that fit.
  const ranked = [...workers].sort((a, b) => (a.role === 'main' ? -1 : b.role === 'main' ? 1 : b.since - a.since))
  for (let n = ranked.length - 1; n > 0; n--) {
    const svg = compose(ranked.slice(0, n), opts, { walkFrames: false, overlays: false })
    if (svg.length <= LIMIT) return { svg }
  }
  return { svg: compose(ranked.slice(0, 1), opts, { walkFrames: false, overlays: false }) }
}

export function statusWords(w: Worker): string {
  switch (w.status) {
    case 'idle':
      return 'idle'
    case 'thinking':
      return 'thinking'
    case 'waiting':
      return `needs you${w.tool ? ': ' + w.tool : ''}`
    case 'leaving':
      return 'done'
    default:
      return `${w.status}${w.tool ? ' · ' + w.tool : ''}${w.detail ? ' ' + w.detail : ''}`
  }
}
