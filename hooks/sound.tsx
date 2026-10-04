import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { isSoundWord } from './format'
import type { Scene } from './paint'

// One sound, off until the person turns it on with s or `/token-monster sound on`: a
// soft two-note chime, once, when Claude starts waiting on them. The clip is the
// plugin's own sounds/call.wav, made by scripts/make-sounds.py. $.audio.play plays it
// with afplay on macOS; other terminals stay silent.
//
// It keeps no rules of its own: it chimes when the monster starts calling (the
// `waiting` atom), so the two can never disagree. Never while the person types.

const sound = atom({ plugin: 'token-monster', key: 'sound' } as const, false)

const CALL = 'sounds/call.wav'
const GAIN = 0.3
// Typed this recently, in ms, the person is typing and the monster keeps quiet.
const TYPING = 2000

const LINE = 'Usage: /token-monster sound on|off'

// What a hot reload may lose: then the atom is read again.
let cached: boolean | undefined

const isOn = async ($: EngineInterface) => (cached ??= await read($, sound))

// Resolves as the clip starts, never when it ends: a hook awaits the checks, not the sound.
const chime = async ($: EngineInterface, scene: Scene) => {
  if (!(await isOn($)) || (await $.clock.now()) - scene.typedMs < TYPING) return

  void $.audio.play({ asset: CALL }, { gain: GAIN }).catch(() => {})
}

const turnOn = async ($: EngineInterface, value: boolean) => {
  cached = value
  await update($, sound, () => value)
  await $.store.set('sound', value)

  if (value && (await $.store.get('soundHeard')) !== true) {
    await $.store.set('soundHeard', true)
    $.ui.toast('Sound on: me chime softly once when Claude waits on you. macOS only. Press s or /token-monster sound off to stop.')
  }
}

// `scene` is the monster's own (register.tsx): plain data may cross an import, $ may not.
export const registerSound = (on: On, scene: Scene) => {
  // A `claude -p` run never plays a sound.
  on('session.start', { isInteractive: true }, async ($, e, next) => {
    const done = await next(e)

    cached = (await $.store.get('sound')) === true
    await update($, sound, () => cached === true)

    return done
  })

  on('command.run', { command: 'token-monster' }, async ($, e, next) => {
    if (!isSoundWord(e.args)) return next(e)

    const word = e.args.trim().toLowerCase().split(/\s+/)[1]

    if (word !== undefined && word !== 'on' && word !== 'off') return { text: LINE }

    const value = word === undefined ? !(await isOn($)) : word === 'on'

    await turnOn($, value)

    return { text: value ? 'Sound on. Me chime when Claude waits on you (macOS).' : 'Sound off. Me call you quietly.' }
  })

  // The monster's s button: the press lands here, as $ cannot cross into this module.
  on('ui.press', { plugin: 'token-monster', element: 'sound' }, async ($, e) => {
    await turnOn($, !(await isOn($)))

    return { element: e.element }
  })

  // Claude started waiting on the person: one chime, not one per dialog while it waits.
  on('state.set', { plugin: 'token-monster', key: 'waiting' }, async ($, e, next) => {
    const done = await next(e)

    if (e.value != null && e.previous == null) await chime($, scene)

    return done
  })
}
