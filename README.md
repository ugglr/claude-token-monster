# Claude Token Monster

[![Dad approved](https://img.shields.io/badge/Dad-approved-brightgreen)](https://github.com/ugglr/dad)

A Tamagotchi for your context window. A Claude Code mod that puts a hungry monster in a side pane. It chews while Claude works, its belly shows how full the context is, and it gets sad when you stop feeding it tokens.

```
  .-.  .-.
 ( O )( O )
/          \
|  .----.  |
|  |    |  |
|  '----'  |
 '--------'

om nom nom nom
████████████░░░░░░░░
60% 120.0k/200.0k
ate 3.1k

session ███████░ 85%
weekly  ██░░░░░░ 22%
pantry getting low...

[Monster] [Color]
```

## What it shows

- **Belly**: how full the context window is, with a bar that goes green, yellow, red.
- **Chewing**: the mouth opens and closes while a turn runs, and it tells you how many tokens it ate.
- **Moods**: hungry when the context is empty, stuffed past 75%, about to burst past 90% (time to `/compact`), and a `*burp*` after a compaction.
- **Hunger**: like a Tamagotchi, it gets sad after 15 minutes without tokens and starves after an hour. Feed it to cheer it up.
- **Pantry**: your session (5 hour) and weekly limits. It feasts when the pantry is full and rations when it runs low. Shown on a Claude subscription only.

## Install

Inside Claude Code:

```
/plugin marketplace add ugglr/claude-token-monster
/plugin install token-monster@token-monster
```

Or clone it and load the folder for one session:

```
git clone https://github.com/ugglr/claude-token-monster
claude --plugin-dir ./claude-token-monster
```

## Use

The pane opens by itself when the terminal is at least 144 columns wide. At any width, run:

```
/token-monster
```

Swap the monster and color from the pane (focus it with `ctrl+x tab`, then press `m` or `c`), or name them:

```
/token-monster slime green
/token-monster chomper
```

Monsters: `cookie`, `chomper`, `slime`. Colors: `blue`, `cyan`, `green`, `yellow`, `magenta`, `red`, `white`. Your pick is remembered across sessions.

## Develop

```
claude plugin validate .
claude plugin test .
```

Mods are not sandboxed, so read the code before you install any mod. This one only reads the context and rate-limit figures Claude Code already shows in its status line, and stores your monster and color choice.

## License

MIT
