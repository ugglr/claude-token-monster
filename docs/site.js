// Token Monster site. Every monster here is drawn by the mod's own renderer,
// hooks/paint.ts, compiled to paint.js (the command is at the top of that file).
// Each one gets its own scene, stepped at 10 frames a second like in the pane,
// and fed a made-up session so it eats, burns, powers up and falls asleep.
import { choke, createScene, fedUp, finishTurn, hatch, hit, levelUp, paint, perk, pet as stroke, serve, startTurn, step, toolColor, typed, wait as calls, AMBER, BURP, BURST, EGG, LEVEL_UP, MINUTE, PALETTE, PROMPT, RED, SAD, STARVING, TEXT, THINKING, WARDROBE } from './paint.js'

const FPS = 10
const COLORS = Object.keys(PALETTE)
const WINDOWS = { five_hour: 'session', seven_day: 'weekly' }
const still = matchMedia('(prefers-reduced-motion: reduce)')
const pets = []
const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

const clockHour = () => {
  const now = new Date()
  return now.getHours() + now.getMinutes() / 60
}
const skyName = hour => (hour < 5 || hour >= 20 ? 'night' : hour < 8 ? 'dawn' : hour < 17.5 ? 'day' : 'dusk')
const hhmm = hour => `${String(Math.floor(hour) % 24).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`

// The readout's helpers and moods, as the mod words them.
const kilo = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))
const span = ms => {
  const minutes = Math.floor(ms / MINUTE)
  const hours = Math.floor(minutes / 60)
  return hours >= 24 ? `${Math.floor(hours / 24)}d${hours % 24}h` : hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`
}
const tone = pct => (pct >= RED ? 'bad' : pct >= AMBER ? 'warn' : 'ok')
const feeling = (belly, at) => {
  const idle = at - belly.fedAt
  if (belly.fill >= BURST) return { eye: '@', say: 'me gonna burst! /compact' }
  if (idle >= STARVING) return { eye: '-', say: 'me starving... feed me tokens' }
  if (idle >= SAD) return { eye: 'T', say: 'me sad. no tokens :(' }
  if (belly.burpAt !== null && at - belly.burpAt < BURP) return { eye: '^', say: '*burp* me feel lighter' }
  if (belly.fill >= 75) return { eye: 'x', say: 'me so full...' }
  if (belly.fill >= 50) return { eye: 'O', say: 'om nom nom nom' }
  if (belly.fill >= 25) return { eye: 'o', say: 'nom nom' }
  return { eye: 'o', say: 'ME WANT TOKENS!' }
}
const larder = limits => {
  const most = Math.max(0, ...limits.map(limit => limit.percentUsed))
  return most >= RED ? 'pantry almost empty! me ration' : most >= AMBER ? 'pantry getting low...' : 'pantry full. feast time!'
}
// Super mode's line, as the mod words it.
const superLine = (level, helpers) =>
  level === 1
    ? helpers === 0 ? 'SUPER MODE! three tools at once' : `SUPER MODE! me and ${helpers} helper${helpers === 1 ? '' : 's'}`
    : level === 2 ? 'SUPER MODE 2!! power rising' : 'SUPER MODE 3!!! power maxed out'
// Its answer to a pet, by how it took it, as the mod words it.
const FUSSES = {
  purr: ['hehe, that tickles', '*purr*', 'more pets pls'],
  wiggle: ['*purrrr* me like you', 'hehe! again!', 'best human'],
  spin: ['wheee! me LOVE you', '*happy spin*', 'best human EVER'],
  stir: ['mmm... *purr*... zzz', '*smiles in its sleep*'],
  plead: ['pets nice... but me so hungry', 'feed me tokens? pleeease'],
}
// The context by category, made up for the belly bar: a fixed system prompt, tools
// and memory, the rest messages. The reserve before auto-compact sits at the far end.
const RESERVE = { short: 'reserve', color: '#6b6f8a', share: 0.2 }
const slicesOf = b => {
  let left = b.tokens
  const take = most => {
    const n = Math.min(left, most)
    left -= n
    return n
  }
  const parts = [
    { short: 'system', color: '#b59cff', tokens: take(9_000) },
    { short: 'tools', color: '#5cc8ff', tokens: take(14_000) },
    { short: 'memory', color: '#ffa94d', tokens: take(3_000) },
  ]
  parts.unshift({ short: 'messages', color: '#ffd166', tokens: left })
  return parts.filter(part => part.tokens > 0).sort((x, y) => y.tokens - x.tokens)
}
const escape = text => text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

// Scripts are generators: each yield is one frame.
function* wait(frames, each) {
  for (let i = 0; i < frames; i++) {
    each?.(i)
    yield
  }
}

class Pet {
  constructor(root, { monster, color, w = 56, h = 40, script, hour, still: pose = 40 }) {
    this.root = root
    this.canvas = $('canvas', root)
    this.w = w
    this.h = h
    this.canvas.width = w
    this.canvas.height = h
    this.canvas.style.setProperty('--w', w)
    this.canvas.style.setProperty('--h', h)
    this.ctx = this.canvas.getContext('2d')
    this.image = this.ctx.createImageData(w, h)
    this.readout = $('[data-readout]', root)
    this.sayLine = $('[data-say]', root)
    this.script = script
    this.pose = pose
    this.hour = hour
    this.visible = false
    this.reset(monster, color)
    pets.push(this)
  }

  reset(monster = this.s.look.monster, color = this.s.look.color) {
    const s = createScene({ monster, color })
    s.at = 10_000_000
    s.hour = this.hour ?? clockHour()
    s.belly = { percent: 30, fill: 37, tokens: 60_000, window: 200_000, ate: 0, fedAt: s.at, burpAt: null, known: true, compactAt: null }
    s.pantry = [
      { kind: 'five_hour', percentUsed: 34 },
      { kind: 'seven_day', percentUsed: 21 },
    ]
    this.s = s
    this.doing = ''
    this.chat = null
    this.gen = this.script(this)
  }

  // The belly in percent of the window; moods go by the share of the auto-compact point.
  belly(percent) {
    const b = this.s.belly
    b.percent = Math.round(Math.max(1, Math.min(100, percent)))
    b.fill = Math.min(100, Math.round(percent / (1 - RESERVE.share)))
    b.tokens = Math.round((b.percent / 100) * b.window)
  }

  eat(tokens, color = TEXT, grow = 0) {
    serve(this.s, tokens, color)
    this.s.belly.fedAt = this.s.at
    this.s.belly.ate = tokens
    if (grow) this.belly(this.s.belly.percent + grow)
  }

  // Run something now, then carry on where it left off.
  interrupt(gen) {
    const rest = this.gen
    this.gen = (function* () {
      yield* gen
      yield* rest
    })()
    if (still.matches) this.advance(14)
  }

  tick() {
    this.s.at += 1000 / FPS
    if (this.hour === undefined) this.s.hour = clockHour()
    if (this.gen.next().done) this.gen = this.script(this)
    step(this.s, this.w, this.h)
  }

  // For reduced motion: move on a few frames and show one still.
  advance(frames) {
    for (let i = 0; i < frames; i++) this.tick()
    this.draw()
  }

  draw() {
    const px = paint(this.s, this.w, this.h)
    const data = this.image.data
    for (let i = 0; i < px.length; i++) {
      const c = px[i]
      data[i * 4] = (c >> 16) & 255
      data[i * 4 + 1] = (c >> 8) & 255
      data[i * 4 + 2] = c & 255
      data[i * 4 + 3] = 255
    }
    this.ctx.putImageData(this.image, 0, 0)
    this.words()
  }

  mood() {
    const s = this.s
    if (this.chat !== null && s.tick < this.chat.until) return this.chat
    if (s.level === 0 || s.belly.fill >= BURST) return feeling(s.belly, s.at)
    return { eye: 'O', say: superLine(s.level, s.minions) }
  }

  // Say something back for a few seconds, over its mood.
  reply(eye, say, frames = 30) {
    this.chat = { eye, say, until: this.s.tick + frames }
  }

  words() {
    const { say } = this.mood()
    const tint = `#${(PALETTE[this.s.look.color] ?? 0x3d7bff).toString(16).padStart(6, '0')}`
    if (this.sayLine) {
      if (this.sayLine.textContent !== say) this.sayLine.textContent = say
      this.sayLine.style.color = tint
    }
    if (!this.readout) return
    const s = this.s
    const b = s.belly
    const width = this.w >= 60 ? 16 : 12
    const row = (name, pct, tail) => {
      const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
      return `<span class="dim">${name.padEnd(8)}</span><span class="${tone(pct)}">${'█'.repeat(filled)}</span><span class="dim">${'░'.repeat(width - filled)}</span>${`${Math.round(pct)}%`.padStart(5)} ${tail}`
    }
    const chain = s.combo >= 2 ? `  on fire x${s.combo}` : ''
    const cold = !s.busy && s.cache !== null && s.at - s.cache.at > s.cache.ttl
    const second = this.doing !== '' ? `> ${this.doing}${chain}` : cold ? `cold cache: next prompt re-reads ~${kilo(s.cache.tokens)} uncached` : b.ate > 0 ? `last bite +${kilo(b.ate)}, fed ${span(s.at - b.fedAt)} ago` : `fed ${span(s.at - b.fedAt)} ago`
    // The belly bar split by category, the reserve at the far end; a legend under it.
    const parts = slicesOf(b)
    let room = width
    const bar = parts.map(part => {
      const cells = Math.min(room, Math.max(1, Math.round((part.tokens / b.window) * width)))
      room -= cells
      return `<span style="color:${part.color}">${'█'.repeat(cells)}</span>`
    })
    const reserve = Math.min(room, Math.round(RESERVE.share * width))
    const belly = `<span class="dim">${'belly'.padEnd(8)}</span>${bar.join('')}<span class="dim">${'░'.repeat(room - reserve)}</span><span style="color:${RESERVE.color}">${'█'.repeat(reserve)}</span>${`${b.percent}%`.padStart(5)} ${kilo(b.tokens)}/${kilo(b.window)}`
    const legend = []
    let line = ''
    let length = 0
    for (const part of [...parts, { ...RESERVE, tokens: RESERVE.share * b.window }]) {
      const text = `${part.short} ${kilo(part.tokens)}`
      if (length > 0 && length + text.length + 4 > 8 + width + 16) {
        legend.push(line)
        line = ''
        length = 0
      }
      line += `${length > 0 ? '  ' : ''}<span style="color:${part.color}">■</span> <span class="dim">${text}</span>`
      length += text.length + 2 + (length > 0 ? 2 : 0)
    }
    legend.push(line)
    const gift = WARDROBE.filter(item => item.level <= s.rank).at(-1)
    const lines = [
      `<span class="say-line" style="color:${tint}">${escape(say)}</span>`,
      `<span class="dim">${escape(second)}</span>`,
      belly,
      ...legend,
      ...s.pantry.map(limit => row(WINDOWS[limit.kind] ?? limit.kind, limit.percentUsed, '')),
      ...(s.rank > 0 ? [`<span class="dim">${`Lv ${s.rank}`.padEnd(8)}${gift ? gift.part : ''}</span>`] : []),
      `<span class="dim">${this.hour !== undefined ? `sky at ${hhmm(s.hour)}` : larder(s.pantry)}</span>`,
    ]
    const html = lines.join('\n')
    if (html !== this.lastHtml) {
      this.readout.innerHTML = html
      this.lastHtml = html
    }
  }
}

// What every monster does when you send a prompt from the bottom of the page.
function* visitorTurn(p, text) {
  const s = p.s
  perk(s)
  serve(s, Math.min(400, 20 + text.length * 3), PROMPT)
  yield* wait(8)
  startTurn(s)
  p.doing = 'thinking...'
  yield* wait(10)
  p.doing = 'om nom'
  yield* wait(18, () => p.eat(5, TEXT))
  for (const tool of ['Read', 'Grep', 'Bash']) {
    s.tools = new Map([['t', tool]])
    p.doing = tool
    hit(s, false, s.at)
    p.eat(260, toolColor(tool), 2)
    yield* wait(5)
  }
  s.tools = new Map()
  p.doing = ''
  finishTurn(s)
  yield* wait(40)
}

// A click on a monster: a quick meal that chains into a combo.
function* snack(p) {
  const s = p.s
  serve(s, 2, PROMPT, false)
  startTurn(s)
  const tools = ['Read', 'Bash', 'Edit', 'Bash']
  for (const tool of tools) {
    s.tools = new Map([['t', tool]])
    p.doing = tool
    hit(s, false, s.at)
    p.eat(300, toolColor(tool), 1)
    yield* wait(4)
  }
  s.tools = new Map()
  p.doing = ''
  finishTurn(s)
  yield* wait(30)
}

// The hero: a scripted Claude Code session, logged on the left and eaten on the right.
const log = $('[data-log]')
const say = (cls, html) => {
  if (!log) return null
  const li = document.createElement('li')
  li.className = cls
  li.innerHTML = html
  log.append(li)
  while (log.children.length > 14) log.firstElementChild.remove()
  return li
}

const SESSIONS = [
  {
    prompt: 'the date test is failing, fix it',
    think: 12,
    open: 'Let me find the test and run it.',
    tools: [
      ['Grep', 'formatDate', 'Found 3 files'],
      ['Read', 'src/date.ts', 'Read 88 lines'],
      ['Bash', 'npm test -- date', '1 failed, 41 passed'],
      ['Edit', 'src/date.ts', 'Updated src/date.ts with 1 change'],
      ['Bash', 'npm test', '42 passed'],
    ],
    close: 'Fixed. Months were read from zero. All 42 tests pass.',
  },
  {
    prompt: 'how do other mods draw a side pane? look around',
    think: 16,
    open: 'I will send two agents to look while I read the docs.',
    agents: true,
    tools: [
      ['Agent', 'Explore the mod examples', 'Done (14 tool uses)'],
      ['WebFetch', 'code.claude.com/docs/mods', 'Received 38.2KB'],
      ['Agent', 'Compare pane layouts', 'Done (9 tool uses)'],
    ],
    close: 'Both use one Pane with a Raster inside, sized to the body columns.',
  },
  {
    prompt: 'add a --json flag to the export command',
    think: 10,
    open: 'Reading the command first.',
    tools: [
      ['Read', 'src/cli/export.ts', 'Read 140 lines'],
      ['Edit', 'src/cli/export.ts', 'Updated src/cli/export.ts with 3 changes'],
      ['Bash', 'npm run build', 'Built in 1.9s'],
      ['Bash', 'node dist/cli.js export --json', '[{"id":1,"name":"…"}]'],
    ],
    close: 'Added --json; it prints the rows as a JSON array.',
  },
]

function* typeOut(p, line, text) {
  for (let i = 0; i < text.length; i++) {
    p.s.typedAt = p.s.tick
    serve(p.s, 1, PROMPT, false)
    if (line) line.textContent = text.slice(0, i + 1)
    yield
  }
}

function* streamOut(p, cls, text, color, frames) {
  const line = say(cls, '')
  for (let i = 0; i < frames; i++) {
    if (line) line.textContent = text.slice(0, Math.ceil(((i + 1) / frames) * text.length))
    p.eat(color === THINKING ? 4 : 6, color, 0.08)
    yield
  }
}

function* heroSession(p) {
  const s = p.s
  p.belly(24)
  let n = 0
  while (true) {
    const run = SESSIONS[n % SESSIONS.length]
    n++
    yield* wait(12)
    const prompt = say('l-prompt', '')
    yield* typeOut(p, prompt, run.prompt)
    perk(s)
    serve(s, 60, PROMPT)
    yield* wait(6)
    startTurn(s)
    p.doing = 'thinking...'
    const thinking = say('l-think', '✻ Thinking…')
    yield* wait(run.think)
    thinking?.remove()
    p.doing = ''
    yield* streamOut(p, 'l-say', run.open, TEXT, 12)
    for (const [i, [tool, arg, result]] of run.tools.entries()) {
      s.tools = new Map([['t', tool]])
      p.doing = `${tool} ${arg}`
      if (run.agents) {
        s.level = Math.min(3, i + 1)
        s.minions = s.level
      }
      const color = toolColor(tool)
      say('l-tool', `<span style="color:#${color.toString(16)}">${escape(tool)}</span>(${escape(arg)})`)
      hit(s, false, s.at)
      p.eat(tool === 'Agent' ? 120 : 420, color, 2.2)
      const frames = run.agents ? 26 : 7
      for (let f = 0; f < frames; f++) {
        if (run.agents) p.eat(f % 2 ? 10 : 14, f % 2 ? TEXT : toolColor('Agent'), 0.05)
        yield
      }
      say('l-result', escape(result))
    }
    s.tools = new Map()
    s.level = 0
    s.minions = 0
    yield* streamOut(p, 'l-say', run.close, TEXT, 14)
    p.doing = ''
    const ko = s.best >= 3
    finishTurn(s)
    if (ko) say('l-ko', '   K.O.')
    yield* wait(40)

    // Past the auto-compact point it gets dizzy; a /compact empties it with a burp.
    if (s.belly.fill >= 82) {
      p.belly(Math.max(s.belly.percent, 74))
      yield* wait(30)
      const line = say('l-prompt', '')
      yield* typeOut(p, line, '/compact')
      perk(s)
      yield* wait(4)
      say('l-result', 'Compacted. ctrl+o to see the summary')
      p.belly(22)
      s.belly.burpAt = s.at
      yield* wait(50)
    }
  }
}

// The specimen beside the table, one script per row.
const loopForever = make => function* (p) {
  while (true) yield* make(p)
}
const STATES = {
  size: loopForever(function* (p) {
    yield* wait(70, i => p.belly(8 + i * 0.95))
    yield* wait(20)
    yield* wait(35, i => p.belly(74 - i * 1.9))
    yield* wait(10)
  }),
  face: loopForever(function* (p) {
    const b = p.s.belly
    for (const pct of [10, 44, 64, 92]) {
      p.belly(pct)
      yield* wait(30)
    }
    p.belly(26)
    b.burpAt = p.s.at
    yield* wait(36)
    b.burpAt = null
  }),
  tears: loopForever(function* (p) {
    const b = p.s.belly
    p.belly(30)
    b.fedAt = p.s.at - 20 * MINUTE
    yield* wait(55)
    b.fedAt = p.s.at - 70 * MINUTE
    yield* wait(55)
    p.doing = 'Read notes.md'
    yield* wait(14, () => p.eat(30, toolColor('Read')))
    p.doing = ''
    yield* wait(30)
  }),
  glow: loopForever(function* (p) {
    for (const pct of [24, 62, 88]) {
      p.s.pantry[0].percentUsed = pct
      p.s.pantry[1].percentUsed = Math.round(pct * 0.6)
      yield* wait(40)
    }
  }),
  chew: loopForever(function* (p) {
    yield* wait(15)
    yield* wait(90, i => p.eat(Math.round(Math.sin((i / 90) * Math.PI) ** 2 * 34), TEXT))
  }),
  tokens: loopForever(function* (p) {
    const s = p.s
    p.doing = ''
    yield* wait(10, () => p.eat(4, THINKING))
    yield* wait(10, () => p.eat(5, TEXT))
    for (const [tool, arg] of [['Read', 'src/app.ts'], ['Grep', 'useStore'], ['Bash', 'npm test'], ['Edit', 'src/app.ts'], ['WebFetch', 'example.com/docs'], ['Agent', 'Review the diff']]) {
      s.tools = new Map([['t', tool]])
      p.doing = `${tool} ${arg}`
      yield* wait(9, i => i < 4 && p.eat(90, toolColor(tool)))
    }
    s.tools = new Map()
    p.doing = ''
    yield* wait(12)
  }),
  typing: loopForever(function* (p) {
    p.doing = ''
    yield* wait(36, i => {
      p.s.typedAt = p.s.tick
      if (i % 3 === 0) serve(p.s, 2, PROMPT, false)
    })
    perk(p.s)
    serve(p.s, 60, PROMPT)
    yield* wait(30)
  }),
  thinking: loopForever(function* (p) {
    startTurn(p.s)
    p.doing = 'thinking...'
    yield* wait(80)
  }),
  fire: loopForever(function* (p) {
    const s = p.s
    for (const failing of [false, true]) {
      startTurn(s)
      yield* wait(6)
      const tools = ['Read', 'Grep', 'Read', 'Bash', 'Edit', 'Bash']
      for (const [i, tool] of tools.entries()) {
        s.tools = new Map([['t', tool]])
        p.doing = tool
        const error = failing && i === 3
        hit(s, error, s.at)
        p.eat(300, toolColor(tool))
        yield* wait(error ? 12 : 5)
      }
      s.tools = new Map()
      p.doing = ''
      finishTurn(s)
      yield* wait(34)
    }
  }),
  call: loopForever(function* (p) {
    const s = p.s
    startTurn(s)
    p.doing = 'Bash npm test'
    yield* wait(15, () => p.eat(6, TEXT))
    calls(s, true)
    p.doing = 'waiting for you: Bash npm test'
    p.reply('O', 'psst! me waiting for you', 70)
    yield* wait(70)
    calls(s, false)
    p.doing = 'Bash npm test'
    yield* wait(10, i => i < 4 && p.eat(90, toolColor('Bash')))
    p.doing = ''
    finishTurn(s)
    yield* wait(30)
  }),
  cold: loopForever(function* (p) {
    const s = p.s
    p.doing = ''
    s.cache = { at: s.at, tokens: 118_000, ttl: 5 * MINUTE }
    yield* wait(30)
    s.cache.at = s.at - 6 * MINUTE
    yield* wait(80)
    s.cache = null
  }),
  gag: loopForever(function* (p) {
    const s = p.s
    startTurn(s)
    p.doing = 'Read logs/build.json'
    yield* wait(12, i => i < 6 && p.eat(400, toolColor('Read')))
    choke(s)
    p.doing = ''
    p.reply('x', '*gag* Read logs/build.json ~31k! d: diet', 40)
    yield* wait(40)
    finishTurn(s)
    yield* wait(30)
  }),
  fedup: loopForever(function* (p) {
    const s = p.s
    startTurn(s)
    for (let i = 0; i < 2; i++) {
      s.tools = new Map([['t', 'Bash']])
      p.doing = 'Bash npm run build'
      yield* wait(8, k => k < 3 && p.eat(60, toolColor('Bash')))
      s.tools = new Map()
      hit(s, true, s.at)
      yield* wait(14)
    }
    fedUp(s)
    p.doing = ''
    p.reply('-', 'ugh. Bash npm run build failed again', 50)
    yield* wait(50)
    finishTurn(s)
    yield* wait(30)
  }),
  hop: loopForever(function* (p) {
    startTurn(p.s)
    yield* wait(12, () => p.eat(6, TEXT))
    finishTurn(p.s)
    yield* wait(36)
  }),
  sleep: loopForever(function* (p) {
    const s = p.s
    p.doing = ''
    s.belly.fedAt = s.at
    s.activeAt = s.tick - 1745
    yield* wait(120)
    yield* wait(20, i => {
      s.typedAt = s.tick
      if (i % 3 === 0) serve(s, 2, PROMPT, false)
    })
    yield* wait(20)
  }),
  hello: loopForever(function* (p) {
    const s = p.s
    p.doing = ''
    s.activeAt = s.tick - 1300
    s.typedAt = s.tick - 1300
    yield* wait(15)
    if (typed(s)) p.reply('^', 'oh hi! you back!')
    yield* wait(30, i => {
      s.typedAt = s.tick
      if (i % 3 === 0) serve(s, 2, PROMPT, false)
    })
    perk(s)
    serve(s, 60, PROMPT)
    yield* wait(30)
  }),
  antics: loopForever(function* (p) {
    const s = p.s
    p.doing = ''
    s.activeAt = s.tick
    yield* wait(8)
    s.anticAt = s.tick
    yield* wait(50)
  }),
  frenzy: loopForever(function* (p) {
    const s = p.s
    startTurn(s)
    s.level = 2
    s.minions = 2
    p.doing = 'Agent Review the diff'
    yield* wait(70, i => p.eat(70, [TEXT, THINKING, toolColor('Agent'), toolColor('Bash')][i % 4]))
    s.level = 0
    s.minions = 0
    p.doing = ''
    finishTurn(s)
    yield* wait(50)
  }),
  pet: loopForever(function* (p) {
    const s = p.s
    s.affection = 0
    yield* wait(10)
    for (let i = 0; i < 5; i++) {
      const fuss = stroke(s, s.at)
      p.reply('^', FUSSES[fuss][i % FUSSES[fuss].length], 22)
      yield* wait(22)
    }
    yield* wait(40)
  }),
  levels: loopForever(function* (p) {
    const s = p.s
    s.rank = 1
    yield* wait(10)
    for (const { level } of WARDROBE) {
      levelUp(s, level)
      yield* wait(LEVEL_UP + 25)
    }
  }),
  egg: loopForever(function* (p) {
    const s = p.s
    s.eggDue = s.at
    hatch(s, s.at)
    p.reply('o', '*crack* ... *crack*', EGG)
    yield* wait(EGG + 40)
  }),
  sky: loopForever(function* (p) {
    yield* wait(240, () => {
      p.s.hour = (p.s.hour + 0.1) % 24
    })
  }),
  super: loopForever(function* (p) {
    const s = p.s
    startTurn(s)
    for (const level of [1, 2, 3]) {
      s.level = level
      s.minions = level
      p.doing = `Agent ${['', 'Explore the repo', 'Review the diff', 'Write the tests'][level]}`
      yield* wait(45, i => p.eat(level * 5, i % 2 ? TEXT : toolColor('Agent')))
    }
    s.level = 0
    s.minions = 0
    p.doing = ''
    finishTurn(s)
    yield* wait(30)
  }),
}

STATES.bar = STATES.size

// Strays and the cast: a life of their own, plus whatever you feed them.
const life = function* (p) {
  const s = p.s
  while (true) {
    yield* wait(20 + Math.floor(Math.random() * 60))
    const roll = Math.random()
    if (roll < 0.45) {
      yield* wait(20 + Math.floor(Math.random() * 20), () => p.eat(4 + Math.floor(Math.random() * 8), Math.random() < 0.3 ? THINKING : TEXT))
    } else if (roll < 0.75) {
      startTurn(s)
      const tools = ['Read', 'Grep', 'Bash', 'Edit', 'WebFetch']
      const count = 2 + Math.floor(Math.random() * 4)
      for (let i = 0; i < count; i++) {
        const tool = tools[Math.floor(Math.random() * tools.length)]
        s.tools = new Map([['t', tool]])
        hit(s, false, s.at)
        p.eat(200, toolColor(tool))
        yield* wait(5)
      }
      s.tools = new Map()
      finishTurn(s)
      yield* wait(30)
    } else {
      yield* wait(24, i => {
        s.typedAt = s.tick
        if (i % 4 === 0) serve(s, 2, PROMPT, false)
      })
      perk(s)
      serve(s, 30, PROMPT)
    }
  }
}

const superLoop = loopForever(function* (p) {
  const s = p.s
  startTurn(s)
  for (const level of [1, 2, 3, 3]) {
    s.level = level
    s.minions = level
    yield* wait(40, i => p.eat(4 + level * 4, i % 2 ? TEXT : toolColor('Agent')))
  }
  s.level = 0
  s.minions = 0
  finishTurn(s)
  yield* wait(50)
})

// Moping and dozing strays perk up when fed, then slip back after half a minute.
const moping = function* (p) {
  while (true) {
    p.s.belly.fedAt = p.s.at - 22 * MINUTE
    while (p.s.at - p.s.belly.fedAt >= SAD) yield
    yield* wait(300)
  }
}

const dozing = function* (p) {
  while (true) {
    // Only a well fed monster dozes off.
    p.s.activeAt = p.s.tick - 1900
    while (p.s.tick - p.s.activeAt >= 1800) {
      p.s.belly.fedAt = p.s.at
      yield
    }
    yield* wait(300)
  }
}

// The diet buddy sits stuffed until the demo below feeds it a /compact.
const stuffed = function* (p) {
  p.belly(71)
  while (true) yield
}

const make = (key, options) => {
  const root = $(`[data-pet="${key}"]`)
  return root ? new Pet(root, options) : null
}

const hero = make('hero', { monster: 'cookie', color: 'blue', w: 64, h: 44, script: heroSession, still: 150 })
const specimen = make('specimen', { monster: 'cookie', color: 'blue', script: STATES.size, still: 50 })
const buddy = make('diet', { monster: 'slime', color: 'green', w: 48, h: 34, script: stuffed })
make('stray-super', { monster: 'gremlin', color: 'magenta', w: 48, h: 34, script: superLoop, still: 70 })
make('stray-sad', { monster: 'cookie', color: 'yellow', w: 48, h: 34, script: moping, still: 45 })
make('stray-sleep', { monster: 'ghost', color: 'cyan', w: 48, h: 34, script: dozing, still: 60 })
for (const [monster, color] of [['cookie', 'blue'], ['slime', 'green'], ['ghost', 'magenta'], ['gremlin', 'red'], ['crab', 'amber']]) {
  const pet = make(`cast-${monster}`, { monster, color, w: 48, h: 36, script: life, still: 30 })
  const recolor = pet && $('[data-color]', pet.root)
  recolor?.addEventListener('click', () => {
    const next = COLORS[(COLORS.indexOf(pet.s.look.color) + 1) % COLORS.length]
    pet.s.look = { monster, color: next }
    $('[data-name]', pet.root).textContent = `/token-monster ${monster} ${next}`
    recolor.setAttribute('aria-label', `Color: ${next}. Change the color`)
    if (still.matches) pet.draw()
  })
}

// Clicking a monster feeds it; strays that mope or doze get cheered up first.
for (const pet of pets) {
  $('.screen', pet.root)?.addEventListener('click', () => {
    if (pet === specimen) {
      pet.reset()
      return pet.advance(still.matches ? 60 : 1)
    }
    if (pet === buddy) return pet.interrupt(snack(pet))
    if (pet === hero) return pet.interrupt(snack(pet))
    pet.s.belly.fedAt = pet.s.at
    pet.interrupt(snack(pet))
  })
}

// The table picks the specimen's state.
const rows = $$('.row[data-state]')
for (const row of rows) {
  row.addEventListener('click', () => {
    for (const other of rows) other.setAttribute('aria-pressed', String(other === row))
    if (!specimen) return
    const script = STATES[row.dataset.state]
    specimen.script = script
    specimen.hour = row.dataset.state === 'sky' ? 5 : undefined
    specimen.reset()
    specimen.advance(still.matches ? 60 : 1)
  })
}

// The diet demo: the same list, keys and wording as the pane.
const diet = $('[data-diet]')
if (diet && buddy) {
  const DISHES = [
    ['Read', 'hooks/paint.ts', 12_400],
    ['Bash', 'Run the full test suite', 8_600],
    ['WebFetch', 'https://docs.example.com/api/v2/reference', 6_100],
    ['Grep', 'serve\\(', 3_300],
    ['Read', 'README.md', 2_900],
    ['Bash', 'List the build output', 1_700],
  ]
  const WINDOW = 200_000
  let context = 142_000
  let picked = new Set()
  let eaten = new Set()
  let armed = []
  const list = $('[data-dishes]', diet)
  const kindList = $('[data-kinds]', diet)
  // Eating by kind: a for every tool result, then one letter per tool, biggest first.
  const KEYS = ['a', 'b', 'f', 'g', 'h', 'j']
  const kinds = () => {
    const left = DISHES.map((_, i) => i).filter(i => !eaten.has(i))
    const byTool = new Map()
    for (const i of left) byTool.set(DISHES[i][0], [...(byTool.get(DISHES[i][0]) ?? []), i])
    return [
      { name: 'all tool results', ids: left },
      ...[...byTool].map(([tool, ids]) => ({ name: tool, ids })).sort((x, y) => saving(y.ids) - saving(x.ids)),
    ].filter(kind => kind.ids.length > 0).slice(0, KEYS.length)
  }
  const pickKind = k => {
    const kind = kinds()[k]
    if (!kind || armed.length > 0) return
    const all = kind.ids.every(i => picked.has(i))
    for (const i of kind.ids) all ? picked.delete(i) : picked.add(i)
    render()
  }
  const contextLine = $('[data-diet-context]', diet)
  const eatButton = $('[data-eat]', diet)
  const armedLine = $('[data-armed]', diet)
  const compact = $('[data-compact]', diet)
  const refill = $('[data-refill]', diet)
  const announce = $('[data-announce]')
  const saving = ids => [...ids].reduce((sum, i) => sum + DISHES[i][2], 0)

  const render = () => {
    list.innerHTML = ''
    DISHES.forEach(([tool, label, tokens], i) => {
      const li = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `dish${eaten.has(i) ? ' eaten' : ''}`
      button.disabled = eaten.has(i) || armed.length > 0
      button.setAttribute('aria-pressed', String(picked.has(i)))
      button.innerHTML = `<span class="name">${eaten.has(i) ? '[-]' : picked.has(i) ? '[x]' : '[ ]'} ${escape(tool)} ${escape(label)}</span><span class="size">~${kilo(tokens)}</span>`
      button.setAttribute('aria-label', `${i + 1}: ${tool} ${label}, about ${kilo(tokens)} tokens${eaten.has(i) ? ', eaten' : ''}`)
      button.addEventListener('click', () => toggle(i))
      li.append(button)
      list.append(li)
    })
    kindList.innerHTML = ''
    kinds().forEach((kind, k) => {
      const li = document.createElement('li')
      const button = document.createElement('button')
      const all = kind.ids.every(i => picked.has(i))
      button.type = 'button'
      button.className = 'dish'
      button.disabled = armed.length > 0
      button.setAttribute('aria-pressed', String(all))
      button.innerHTML = `<span class="name">${KEYS[k]} ${all ? '[x]' : '[ ]'} ${escape(kind.name)}</span><span class="size">~${kilo(saving(kind.ids))}</span>`
      button.addEventListener('click', () => pickKind(k))
      li.append(button)
      kindList.append(li)
    })
    $('[data-edible]', diet).textContent = kilo(saving(DISHES.map((_, i) => i).filter(i => !eaten.has(i))))
    const now = `${Math.round((context / WINDOW) * 100)}% ${kilo(context)}/${kilo(WINDOW)}`
    const after = picked.size === 0 ? '' : ` -> ~${Math.round(((context - saving(picked)) / WINDOW) * 100)}% after`
    contextLine.textContent = `context ${now}${after}`
    eatButton.textContent = picked.size === 0 ? 'Eat' : `Eat ${picked.size} (frees ~${kilo(saving(picked))})`
    eatButton.disabled = picked.size === 0 || armed.length > 0
    armedLine.hidden = armed.length === 0
    compact.hidden = armed.length === 0
    $('[data-plate]', diet).textContent = kilo(saving(armed))
    refill.hidden = eaten.size === 0
  }
  const toggle = i => {
    if (eaten.has(i) || armed.length > 0) return
    picked.has(i) ? picked.delete(i) : picked.add(i)
    render()
  }
  const arm = () => {
    if (picked.size === 0) return
    armed = [...picked]
    render()
    $('[data-enter]', diet).focus()
  }
  const disarm = () => {
    armed = []
    render()
    eatButton.focus()
  }
  const enter = () => {
    const freed = saving(armed)
    for (const i of armed) eaten.add(i)
    context -= freed
    picked = new Set()
    armed = []
    buddy.belly((context / WINDOW) * 100)
    buddy.s.belly.burpAt = buddy.s.at
    buddy.s.belly.ate = 0
    if (still.matches) buddy.advance(8)
    announce.textContent = `Token Monster ate about ${kilo(freed)} tokens. Context is now ${Math.round((context / WINDOW) * 100)}%.`
    render()
    refill.hidden ? eatButton.focus() : refill.focus()
  }
  eatButton.addEventListener('click', arm)
  $('[data-cancel]', diet).addEventListener('click', disarm)
  $('[data-enter]', diet).addEventListener('click', enter)
  refill.addEventListener('click', () => {
    eaten = new Set()
    picked = new Set()
    context = 142_000
    buddy.belly(71)
    buddy.s.belly.burpAt = null
    if (still.matches) buddy.draw()
    render()
    eatButton.focus()
  })
  diet.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
    const digit = Number(e.key)
    if (digit >= 1 && digit <= DISHES.length) toggle(digit - 1)
    else if (e.key === 'e') arm()
    else if (e.key === 'x' && armed.length > 0) disarm()
    else if (KEYS.includes(e.key)) pickKind(KEYS.indexOf(e.key))
    else if (e.key === 'r') render()
    else if (e.key === 'q') $('.screen', buddy.root).focus()
    else return
    e.preventDefault()
  })
  render()
}

// Copy buttons.
for (const button of $$('[data-copy]')) {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy)
      button.textContent = 'Copied'
    } catch {
      button.textContent = 'Select and copy'
    }
    setTimeout(() => (button.textContent = 'Copy'), 1600)
  })
}

// The prompt at the bottom: typing makes every monster on screen drool, each
// letter flies into a mouth, and Enter sends them all a turn.
const form = $('[data-prompt]')
const input = $('#feed')
const onScreen = () => pets.filter(p => p.visible)
const mouthOf = p => {
  const box = p.canvas.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height * 0.66 }
}
const fly = (char, from, pet) => {
  if (still.matches || char.trim() === '') return
  const to = mouthOf(pet)
  const glyph = document.createElement('span')
  glyph.className = 'glyph'
  glyph.textContent = char
  glyph.setAttribute('aria-hidden', 'true')
  document.body.append(glyph)
  const lift = Math.min(from.y, to.y) - 80
  const flight = glyph.animate(
    [
      { transform: `translate(${from.x}px, ${from.y}px) scale(1.4)`, opacity: 1 },
      { transform: `translate(${(from.x + to.x) / 2}px, ${lift}px) scale(1.1)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(.4)`, opacity: 0.2 },
    ],
    { duration: 700 + Math.random() * 250, easing: 'cubic-bezier(.3,.1,.5,1)' },
  )
  flight.onfinish = () => {
    glyph.remove()
    pet.s.typedAt = pet.s.tick
    serve(pet.s, 2, PROMPT, false)
  }
}
input?.addEventListener('input', e => {
  const seen = onScreen()
  for (const p of seen) {
    p.s.typedAt = p.s.tick
    if (still.matches) p.advance(2)
  }
  const char = e.data?.slice(-1)
  if (char && seen.length > 0) {
    const box = input.getBoundingClientRect()
    const caret = Math.min(box.right - 10, box.left + input.value.length * 9)
    fly(char, { x: caret, y: box.top }, seen[Math.floor(Math.random() * seen.length)])
  }
})
form?.addEventListener('submit', e => {
  e.preventDefault()
  const text = input.value.trim()
  if (text === '') return
  for (const p of onScreen()) {
    if (p === hero) {
      say('l-prompt', escape(text))
      say('l-say', `Me ate your prompt: about ${Math.max(1, Math.round(text.length / 4))} tokens.`)
    }
    p.s.belly.fedAt = p.s.at
    p.interrupt(visitorTurn(p, text))
  }
  input.value = ''
})

// The one-line band above the prompt follows the hero, the way the mod's band does.
const band = $('[data-band]')
const drawBand = () => {
  if (!band || !hero) return
  const s = hero.s
  const { eye, say: words } = s.level > 0 && s.belly.fill < BURST ? { eye: 'O', say: superLine(s.level, s.minions) } : feeling(s.belly, s.at)
  const head = `(${eye})(${eye}) ${hero.doing !== '' ? `> ${hero.doing}${s.combo >= 2 ? ` on fire x${s.combo}` : ''}` : words}`
  const filled = Math.round((s.belly.percent / 100) * 8)
  const html = `<span class="face" style="color:#3d7bff">${escape(head)}</span> <span class="${tone(s.belly.percent)}">${'█'.repeat(filled)}</span><span class="dim">${'░'.repeat(8 - filled)}</span> ${s.belly.percent}%<span class="dim">${s.pantry.map(l => `  ${WINDOWS[l.kind]} ${l.percentUsed}%`).join('')}  /token-monster</span>`
  if (html !== band.lastHtml) {
    band.innerHTML = html
    band.lastHtml = html
  }
}

// The sky label in the top bar, by the visitor's own clock.
const sky = $('[data-sky]')
const drawSky = () => {
  if (!sky) return
  const hour = clockHour()
  sky.textContent = `${skyName(hour)} ${hhmm(hour)}`
}

// Only monsters on screen are stepped and painted.
const watcher = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const pet = pets.find(p => p.root === entry.target)
    if (pet) pet.visible = entry.isIntersecting
  }
}, { rootMargin: '80px' })
for (const pet of pets) watcher.observe(pet.root)

let last = 0
let running = false
const frame = now => {
  if (!running) return
  requestAnimationFrame(frame)
  if (now - last < 1000 / FPS - 4) return
  last = now
  for (const pet of pets) {
    if (!pet.visible) continue
    pet.tick()
    pet.draw()
  }
  drawBand()
}

const start = () => {
  drawSky()
  if (still.matches) {
    running = false
    // One telling still each: the hero mid-combo, the others in their pose.
    for (const pet of pets) pet.advance(pet.pose)
    drawBand()
  } else if (!running) {
    running = true
    for (const pet of pets) pet.draw()
    requestAnimationFrame(frame)
  }
}
still.addEventListener('change', start)
setInterval(drawSky, 30_000)
start()
