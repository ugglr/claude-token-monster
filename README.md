# Claude Token Monster

A pixel-art Tamagotchi that lives in a side pane of Claude Code and eats your tokens. It is also a dashboard: one glance at the monster tells you how full your context is, how close you are to your limits, and what Claude is doing right now.

![Token Monster eating through a session](media/demo.gif)

## Read the monster

| What you see | What it means |
| --- | --- |
| **Its size** | How full the context window is. The belly inflates as the context fills. |
| **Its face** | Its mood: hungry, happy, stuffed past 75%, dizzy eyes past 90% (time to `/compact`), a happy squint after a burp. |
| **Tears, then sleepy Zs** | Tamagotchi hunger: sad after 15 minutes without tokens, starving after an hour. Feed it to cheer it up. |
| **The glow around it** | Your session and weekly limits: green with room to spare, amber past 50%, pulsing red past 80%. It sweats when you get close. |
| **Tokens flying into its mouth** | Claude is working. The color says which tool: green Bash, blue reads and searches, orange edits, purple web, pink agents, gold for thinking. |
| **Looking down and drooling** | You are typing. Your prompt floats up into its mouth when you send it. |
| **Mini monsters** | One per running subagent. |
| **Angry brows** | A tool just failed. |

Under the sprite, a readout gives the exact numbers:

```
om nom nom nom
> Bash npm test
belly   ████████████░░░░░░░░  62% 124k/200k
session ███████░░░░░░░░░░░░░  35% 2h14m
weekly  ████░░░░░░░░░░░░░░░░  22% 4d3h
[Monster] [Color] [Diet]
```

![Every monster and mood](media/moods.png)

## Put it on a diet

Today you can only `/clear` or `/compact` the whole conversation. The diet lets you pick exactly what to drop. Press `d` in the pane, or run `/token-monster diet`, to list the biggest tool results in the conversation (file reads, command output, web pages). Tick the ones you no longer need and press **Eat**.

Each eaten result is replaced by a short note, so the model knows something was there and can run the tool again if it needs it. Everything else in the conversation stays exactly as it was. Eating works between turns, and the next turn reads the context uncached once.

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

The pane opens by itself when the terminal is at least 144 columns wide. At any width, run `/token-monster`. In fullscreen it docks beside the transcript; otherwise it sits above the prompt.

Focus the pane with `ctrl+x tab`, then press `m` to swap the monster, `c` to swap the color, and `d` for the diet. Or name them:

```
/token-monster slime green
/token-monster gremlin
/token-monster diet
```

Monsters: `cookie`, `slime`, `ghost`, `gremlin`. Colors: `blue`, `cyan`, `green`, `yellow`, `magenta`, `red`, `white`. Your pick is remembered across sessions.

The pixel art draws in the terminal. The desktop app and IDEs show an ASCII version of the monster with the same readout.

The limit bars show whatever limits Claude Code reports: the 5-hour session and weekly windows on a Claude subscription, or a gateway's spend limit.

## Develop

```
claude plugin validate .
claude plugin test .
```

Mods are not sandboxed, so read the code before you install any mod. This one reads the context, limit and activity figures Claude Code already shows you, lists tool results for the diet, and stores your monster and color choice. It sends nothing anywhere.

## License

MIT
