import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { PANE, tokens } from './format'
import { COMBO_MS, MINUTE, SAD } from './paint'

// Chiptune sound, off until the person turns it on with s or `/token-monster sound on`.
// The clips are the plugin's own files in sounds/, made by scripts/make-sounds.py.
// $.audio.play plays them with afplay on macOS; other terminals stay silent.
//
// Never annoying: quiet gains, one clip of a kind at a time, chomps at most three a
// second and only while the pane shows, and nothing at all while the person types.

const sound = atom({ plugin: 'token-monster', key: 'sound' } as const, false)
// The monster's own readings, for when it gets hungry and when it last burped.
const belly = atom({ plugin: 'token-monster', key: 'belly' } as const, null)

type Kind = keyof typeof CLIPS

const CLIPS = {
  chomp: ['sounds/chomp-1.wav', 'sounds/chomp-2.wav', 'sounds/chomp-3.wav'],
  gulp: ['sounds/gulp.wav'],
  burp: ['sounds/burp.wav'],
  combo: ['sounds/combo-1.wav', 'sounds/combo-2.wav', 'sounds/combo-3.wav', 'sounds/combo-4.wav', 'sounds/combo-5.wav'],
  ko: ['sounds/ko.wav'],
  powerUp: ['sounds/power-up.wav'],
  powerDown: ['sounds/power-down.wav'],
  cheer: ['sounds/cheer.wav'],
  whimper: ['sounds/whimper.wav'],
  error: ['sounds/error.wav'],
  snore: ['sounds/snore.wav'],
  hello: ['sounds/hello.wav'],
}

// Linear gain per kind: quiet by default, the frequent and the ambient quieter still.
const GAIN: Record<Kind, number> = {
  chomp: 0.2,
  gulp: 0.3,
  burp: 0.35,
  combo: 0.3,
  ko: 0.35,
  powerUp: 0.3,
  powerDown: 0.25,
  cheer: 0.3,
  whimper: 0.3,
  error: 0.3,
  snore: 0.15,
  hello: 0.3,
}

// How long a kind holds its slot, in ms: the clip's length, or longer to space it out.
// A chomp every 350 ms is under three a second.
const HOLD: Record<Kind, number> = {
  chomp: 350,
  gulp: 400,
  burp: 5000,
  combo: 160,
  ko: 700,
  powerUp: 450,
  powerDown: 450,
  cheer: 300,
  whimper: 700,
  error: 300,
  snore: 700,
  hello: 400,
}

// The kinds that only play while the pane shows: the eating and the idle noises.
const AMBIENT: ReadonlySet<Kind> = new Set(['chomp', 'gulp', 'whimper', 'snore'])

// A tool result this big, in tokens, is gulped rather than chomped.
const BIG = 2000
// Typed this recently, in ms, the person is typing and the monster keeps quiet.
const TYPING = 2000
// It snores after this long with nothing happening, at most once per SNORE_EVERY.
const DOZE = 3 * MINUTE
const SNORE_EVERY = 10 * MINUTE

const LINE = 'Usage: /token-monster sound on|off'

// `/token-monster sound`, with on or off or nothing after it.
export const isSoundWord = (args: string) => args.trim().toLowerCase().split(/\s+/)[0] === 'sound'

// What a hot reload may lose: then the atom is read again, and the rest starts over.
let cached: boolean | undefined
const until = new Map<Kind, number>()
let typedAt = -Infinity
let activeAt: number | undefined
let snoredAt = -Infinity
let whimperedFor: number | undefined
let isBusy = false
let combo = 0
let best = 0
let lastHitAt = -Infinity
let isChomping = false

const isOn = async ($: EngineInterface) => (cached ??= await read($, sound))

const isShown = async ($: EngineInterface) => (await $.ui.panes()).some(pane => pane.id === PANE && pane.isShown)

// Plays one clip of `kind` unless something holds it back, and says whether it did.
// Resolves as the clip starts, never when it ends: a hook awaits the checks, not the sound.
// `isAsked`: the person just turned it on, so their typing does not hold it back.
const play = async ($: EngineInterface, kind: Kind, pick = 0, isAsked = false) => {
  if (!(await isOn($))) return false

  const at = await $.clock.now()

  if (at < (until.get(kind) ?? -Infinity)) return false
  if (!isAsked && at - typedAt < TYPING) return false
  if (AMBIENT.has(kind) && !(await isShown($))) return false

  const names = CLIPS[kind]

  until.set(kind, at + HOLD[kind])
  void $.audio
    .play({ asset: names[Math.max(0, Math.min(names.length - 1, pick))]! }, { gain: GAIN[kind] })
    .catch(() => {})

  return true
}

const chomp = ($: EngineInterface) => play($, 'chomp', Math.floor(Math.random() * CLIPS.chomp.length))

const stir = async ($: EngineInterface) => {
  activeAt = await $.clock.now()
}

const turnOn = async ($: EngineInterface, value: boolean) => {
  cached = value
  await update($, sound, () => value)
  await $.store.set('sound', value)

  if (!value) return

  if ((await $.store.get('soundHeard')) !== true) {
    await $.store.set('soundHeard', true)
    $.ui.toast('Sound on: me chomp, burp and cheer out loud, quietly. macOS only. Press s or /token-monster sound off to stop.')
  }

  await play($, 'hello', 0, true)
}

// The monster's own hooks on these events stand unmatched, and an event takes one
// unmatched hook per plugin: `{}` matches every one of them all the same.
export const registerSound = (on: On) => {
  // A `claude -p` run never plays a sound.
  on('session.start', { isInteractive: true }, async ($, e, next) => {
    const done = await next(e)

    cached = (await $.store.get('sound')) === true
    await update($, sound, () => cached === true)
    await play($, 'hello')

    return done
  })

  on('command.run', { command: 'token-monster' }, async ($, e, next) => {
    if (!isSoundWord(e.args)) return next(e)

    const word = e.args.trim().toLowerCase().split(/\s+/)[1]

    if (word !== undefined && word !== 'on' && word !== 'off') return { text: LINE }

    const value = word === undefined ? !(await isOn($)) : word === 'on'

    await turnOn($, value)

    return { text: value ? 'Sound on. Me make noise now (macOS).' : 'Sound off. Me eat quietly.' }
  })

  // The monster's s button: the press lands here, as $ cannot cross into this module.
  on('ui.press', { plugin: 'token-monster', element: 'sound' }, async ($, e) => {
    await turnOn($, !(await isOn($)))

    return { element: e.element }
  })

  on('prompt.edit', { origin: { kind: 'composer' } }, ($, e, next) => {
    if (cached === true) void $.clock.now().then(at => (activeAt = typedAt = at))

    return next(e)
  })

  // The stream is eaten as it comes: a chomp now and then, never holding a chunk up.
  on('turn.step', {}, async function* ($, e, next) {
    for await (const chunk of next(e)) {
      if (cached === true && !isChomping && (chunk.kind === 'text' || chunk.kind === 'thinking')) {
        isChomping = true
        void stir($)
          .then(() => chomp($))
          .catch(() => {})
          .finally(() => (isChomping = false))
      }

      yield chunk
    }
  })

  on('turn.start', {}, ($, e, next) => {
    isBusy = true
    combo = 0
    best = 0

    return next(e)
  })

  // A turn that landed a combo of three or more ends in a K.O.; any other a little cheer.
  on('turn.complete', {}, async ($, e, next) => {
    const done = await next(e)

    if (e.agentId === undefined) {
      const landed = best

      isBusy = false
      combo = 0
      best = 0

      if (await isOn($)) {
        await stir($)
        if (landed >= 3) await play($, 'ko')
        else if (!e.isAborted) await play($, 'cheer')
      }
    }

    return done
  })

  // Each result is a bite. In the main loop the calls chain as the monster's combo
  // does (paint.ts hit()): a failed call buzzes, a chain climbs in pitch, a big result is gulped.
  on('tool.call', {}, async ($, e, next) => {
    const ran = await next(e)

    if (!(await isOn($))) return ran

    await stir($)

    const isBig = tokens(ran.text) >= BIG

    if (e.agentId !== undefined) {
      await (isBig ? play($, 'gulp') : chomp($))

      return ran
    }

    const at = await $.clock.now()

    combo = at - lastHitAt > COMBO_MS ? 1 : combo + 1
    best = Math.max(best, combo)
    lastHitAt = at

    if (ran.isError === true) await play($, 'error')
    else if (combo >= 2) await play($, 'combo', combo - 2)
    else if (isBig) await play($, 'gulp')
    else await chomp($)

    return ran
  })

  // Super mode: a rising arpeggio as it starts or climbs, a falling one when it ends.
  on('state.set', { plugin: 'token-monster', key: 'level' }, async ($, e, next) => {
    const done = await next(e)
    const value = Number(e.value ?? 0)
    const previous = Number(e.previous ?? 0)

    if (value > previous) await play($, 'powerUp')
    else if (value === 0 && previous > 0) await play($, 'powerDown')

    return done
  })

  // A burp, from /compact or from the context shrinking on its own.
  on('state.set', { plugin: 'token-monster', key: 'belly' }, async ($, e, next) => {
    const done = await next(e)
    const value = e.value as { burpAt: number | null } | null
    const previous = e.previous as { burpAt: number | null } | null | undefined

    if (value !== null && value.burpAt !== null && value.burpAt !== previous?.burpAt) await play($, 'burp')

    return done
  })

  // The clock the monster keeps, about once a minute: it whimpers once as it gets
  // hungry, and snores now and then once nothing has happened for a while.
  on('state.set', { plugin: 'token-monster', key: 'now' }, async ($, e, next) => {
    const done = await next(e)

    if (!(await isOn($))) return done

    const at = Number(e.value)
    const full = await read($, belly)

    activeAt ??= at

    if (full !== null && at - full.fedAt >= SAD && whimperedFor !== full.fedAt) {
      if (await play($, 'whimper')) whimperedFor = full.fedAt
    } else if (!isBusy && at - activeAt >= DOZE && at - snoredAt >= SNORE_EVERY) {
      if (await play($, 'snore')) snoredAt = at
    }

    return done
  })
}
