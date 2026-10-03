import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { PANE, isSoundWord, tokens } from './format'
import { MINUTE, SAD, asleep } from './paint'
import type { Scene } from './paint'

// Chiptune sound, off until the person turns it on with s or `/token-monster sound on`.
// The clips are the plugin's own files in sounds/, made by scripts/make-sounds.py.
// $.audio.play plays them with afplay on macOS; other terminals stay silent.
//
// The sound keeps no rules of its own: it reads the monster's scene (its combo, how a
// turn ended, whether it sleeps or starves), so the two can never disagree. Never
// annoying: quiet gains, one clip of a kind at a time, chomps at most three a second
// and only while the pane shows, and nothing at all while the person types.

const sound = atom({ plugin: 'token-monster', key: 'sound' } as const, false)

type Kind = keyof typeof CLIPS

// Each kind: its files, its gain (linear, quiet by default), how long it holds its
// slot in ms (the clip's length, or longer to space it out), and whether it only
// plays while the pane shows (the eating and idle noises).
const CLIPS = {
  chomp: { files: ['sounds/chomp-1.wav', 'sounds/chomp-2.wav', 'sounds/chomp-3.wav'], gain: 0.2, hold: 350, ambient: true },
  gulp: { files: ['sounds/gulp.wav'], gain: 0.3, hold: 400, ambient: true },
  burp: { files: ['sounds/burp.wav'], gain: 0.35, hold: 5000, ambient: false },
  combo: {
    files: ['sounds/combo-1.wav', 'sounds/combo-2.wav', 'sounds/combo-3.wav', 'sounds/combo-4.wav', 'sounds/combo-5.wav'],
    gain: 0.3,
    hold: 160,
    ambient: false,
  },
  ko: { files: ['sounds/ko.wav'], gain: 0.35, hold: 700, ambient: false },
  powerUp: { files: ['sounds/power-up.wav'], gain: 0.3, hold: 450, ambient: false },
  powerDown: { files: ['sounds/power-down.wav'], gain: 0.25, hold: 450, ambient: false },
  cheer: { files: ['sounds/cheer.wav'], gain: 0.3, hold: 300, ambient: false },
  whimper: { files: ['sounds/whimper.wav'], gain: 0.3, hold: 700, ambient: true },
  error: { files: ['sounds/error.wav'], gain: 0.3, hold: 300, ambient: false },
  snore: { files: ['sounds/snore.wav'], gain: 0.15, hold: 700, ambient: true },
  hello: { files: ['sounds/hello.wav'], gain: 0.3, hold: 400, ambient: false },
}

// A tool result this big, in tokens, is gulped rather than chomped.
const BIG = 2000
// Typed this recently, in ms, the person is typing and the monster keeps quiet.
const TYPING = 2000
// While it sleeps it snores, at most once per SNORE_EVERY.
const SNORE_EVERY = 10 * MINUTE

const LINE = 'Usage: /token-monster sound on|off'

// What a hot reload may lose: then the atom is read again, and the rest starts over.
let cached: boolean | undefined
const until = new Map<Kind, number>()
let snoredAt = -Infinity
let whimperedFor: number | undefined
let isChomping = false

const isOn = async ($: EngineInterface) => (cached ??= await read($, sound))

const isShown = async ($: EngineInterface) => (await $.ui.panes()).some(pane => pane.id === PANE && pane.isShown)

// Plays one clip of `kind` unless something holds it back, and says whether it did.
// Resolves as the clip starts, never when it ends: a hook awaits the checks, not the sound.
// `isAsked`: the person just turned it on, so their typing does not hold it back.
const play = async ($: EngineInterface, scene: Scene, kind: Kind, pick = 0, isAsked = false) => {
  if (!(await isOn($))) return false

  const at = await $.clock.now()
  const clip = CLIPS[kind]

  if (at < (until.get(kind) ?? -Infinity)) return false
  if (!isAsked && at - scene.typedMs < TYPING) return false
  if (clip.ambient && !(await isShown($))) return false

  until.set(kind, at + clip.hold)
  void $.audio
    .play({ asset: clip.files[Math.max(0, Math.min(clip.files.length - 1, pick))]! }, { gain: clip.gain })
    .catch(() => {})

  return true
}

const chomp = ($: EngineInterface, scene: Scene) => play($, scene, 'chomp', Math.floor(Math.random() * CLIPS.chomp.files.length))

const turnOn = async ($: EngineInterface, scene: Scene, value: boolean) => {
  cached = value
  await update($, sound, () => value)
  await $.store.set('sound', value)

  if (!value) return

  if ((await $.store.get('soundHeard')) !== true) {
    await $.store.set('soundHeard', true)
    $.ui.toast('Sound on: me chomp, burp and cheer out loud, quietly. macOS only. Press s or /token-monster sound off to stop.')
  }

  await play($, scene, 'hello', 0, true)
}

// `scene` is the monster's own (register.tsx): plain data may cross an import, $ may not.
// These hooks are registered before the monster's, so they run outside them: after
// `await next(e)` the monster has already counted the combo and recorded the turn's end.
// The monster also hooks turn.step, turn.complete and tool.call unmatched, and an
// event takes one unmatched hook per plugin, so those three carry `{}`.
export const registerSound = (on: On, scene: Scene) => {
  // A `claude -p` run never plays a sound.
  on('session.start', { isInteractive: true }, async ($, e, next) => {
    const done = await next(e)

    cached = (await $.store.get('sound')) === true
    await update($, sound, () => cached === true)
    await play($, scene, 'hello')

    return done
  })

  on('command.run', { command: 'token-monster' }, async ($, e, next) => {
    if (!isSoundWord(e.args)) return next(e)

    const word = e.args.trim().toLowerCase().split(/\s+/)[1]

    if (word !== undefined && word !== 'on' && word !== 'off') return { text: LINE }

    const value = word === undefined ? !(await isOn($)) : word === 'on'

    await turnOn($, scene, value)

    return { text: value ? 'Sound on. Me make noise now (macOS).' : 'Sound off. Me eat quietly.' }
  })

  // The monster's s button: the press lands here, as $ cannot cross into this module.
  on('ui.press', { plugin: 'token-monster', element: 'sound' }, async ($, e) => {
    await turnOn($, scene, !(await isOn($)))

    return { element: e.element }
  })

  // The stream is eaten as it comes: a chomp now and then, gated without a dispatch
  // per chunk, never holding a chunk up.
  on('turn.step', {}, async function* ($, e, next) {
    for await (const chunk of next(e)) {
      if (cached === true && !isChomping && (chunk.kind === 'text' || chunk.kind === 'thinking')) {
        isChomping = true
        void chomp($, scene).catch(() => {})
        $.clock.after(CLIPS.chomp.hold, () => (isChomping = false))
      }

      yield chunk
    }
  })

  // A K.O., a cheer, or nothing for an interrupted turn: as the monster ended it.
  on('turn.complete', {}, async ($, e, next) => {
    const done = await next(e)

    if (e.agentId === undefined && scene.ended !== 'quiet') await play($, scene, scene.ended)

    return done
  })

  // Each result is a bite: a failed call buzzes, a chain climbs in pitch with the
  // monster's combo, a big result is gulped.
  on('tool.call', {}, async ($, e, next) => {
    const ran = await next(e)

    if (!(await isOn($))) return ran

    const isBig = tokens(ran.text) >= BIG

    if (e.agentId === undefined && ran.isError === true) await play($, scene, 'error')
    else if (e.agentId === undefined && scene.combo >= 2) await play($, scene, 'combo', scene.combo - 2)
    else await (isBig ? play($, scene, 'gulp') : chomp($, scene))

    return ran
  })

  // Super mode: a rising arpeggio as it starts or climbs, a falling one when it ends.
  on('state.set', { plugin: 'token-monster', key: 'level' }, async ($, e, next) => {
    const done = await next(e)
    const value = Number(e.value ?? 0)
    const previous = Number(e.previous ?? 0)

    if (value > previous) await play($, scene, 'powerUp')
    else if (value === 0 && previous > 0) await play($, scene, 'powerDown')

    return done
  })

  // A burp, from /compact or from the context shrinking on its own.
  on('state.set', { plugin: 'token-monster', key: 'belly' }, async ($, e, next) => {
    const done = await next(e)
    const value = e.value as { burpAt: number | null } | null
    const previous = e.previous as { burpAt: number | null } | null | undefined

    if (value !== null && value.burpAt !== null && value.burpAt !== previous?.burpAt) await play($, scene, 'burp')

    return done
  })

  // The clock the monster keeps, about once a minute: it whimpers once as it gets
  // hungry, and snores now and then while it sleeps.
  on('state.set', { plugin: 'token-monster', key: 'now' }, async ($, e, next) => {
    const done = await next(e)

    if (!(await isOn($))) return done

    const at = Number(e.value)
    const fedAt = scene.belly?.fedAt

    if (fedAt !== undefined && at - fedAt >= SAD) {
      if (whimperedFor !== fedAt && (await play($, scene, 'whimper'))) whimperedFor = fedAt
    } else if (asleep(scene) && at - snoredAt >= SNORE_EVERY) {
      if (await play($, scene, 'snore')) snoredAt = at
    }

    return done
  })
}
