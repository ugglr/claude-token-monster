# Claude Token Monster

[![Dad approved](https://img.shields.io/badge/Dad-approved-brightgreen)](https://github.com/ugglr/dad)

A pixel-art Tamagotchi that lives in a side pane of Claude Code and eats your tokens. It is also a dashboard: one glance at the monster tells you how full your context is, how close you are to your limits, and what Claude is doing right now.

![Token Monster eating through a session](media/demo.gif)

## Read the monster

| What you see | What it means |
| --- | --- |
| **Its size** | How full the context window is. The belly inflates as the context fills. |
| **Its face** | Its mood: hungry, happy, stuffed past 75%, dizzy eyes past 90% (time to `/compact`), a happy squint after a burp. |
| **Tears, then sleepy Zs** | Tamagotchi hunger: sad after 15 minutes without tokens, starving after an hour. Feed it to cheer it up. |
| **The glow around it** | Your session and weekly limits: green with room to spare, amber past 50%, pulsing red past 80%. It sweats when you get close. |
| **How hard it chews** | How fast tokens are flowing right now. It sits still when nothing streams, nibbles as Claude starts writing, and chomps, bounces and shakes as the rate climbs. |
| **Tokens flying into its mouth** | The actual stream, piece by piece: gold for text, lilac for thinking, then by tool: green Bash, blue reads and searches, orange edits, purple web, pink agents. A big tool result is a big meal. |
| **Looking down and drooling** | You are typing. Your prompt floats up into its mouth when you send it. |
| **"7 HITS"** | A combo: tool calls landing back to back, fighting game style. A turn that landed a combo of three or more ends in a **K.O.**; a failed tool call flashes **COUNTER**. |
| **Super mode** | Subagents power it up: a golden flame aura, spiky gold hair and teal eyes. Each running subagent (or three tools at once) adds a level; level 2 crackles with lightning, level 3 is over 9000. Its helpers bounce beside it. A belly about to burst or a limit past 80% still shows through. |
| **Angry brows** | A tool just failed. |

Under the sprite, a readout gives the exact numbers:

```
om nom nom nom
> Bash Run the tests  4 HIT COMBO
belly   ████████████░░░░░░░░  62% 124k/200k
session ███████░░░░░░░░░░░░░  35% 2h14m
weekly  ████░░░░░░░░░░░░░░░░  22% 4d3h
[Monster] [Color] [Diet: free context]
```

![Every monster and mood](media/moods.png)

## Put it on a diet

Today you can only `/clear` or `/compact` the whole conversation. The diet lets you pick what goes. Press `d` in the pane, or run `/token-monster diet` (or `eat`), to switch the pane to the diet and list the biggest tool results sitting in this conversation's context right now (file reads, command output, web pages), with the context fill and where it would land after eating. Press `1` to `9` to tick the ones you no longer need, then `e` to **Eat**, or `q` to go back to the monster.

Eat arms the diet, puts `/compact` in your prompt, and the monster tells you how many tokens it is about to eat from the context. Press Enter, and instead of summarizing the conversation, Token Monster replaces each picked result with a short note, so the model knows something was there and can run the tool again if it needs it. **Cancel** in the pane disarms it, and an automatic compaction is never touched. If the picked results are already gone (an earlier compaction or `/clear` took them), the diet disarms and your `/compact` summarizes as usual.

What changes, exactly: each message holding an eaten result is rebuilt from its text. The diet only offers results whose message holds no image or document, so nothing else in it is lost; several text blocks in such a message are joined into one. Every other message stays exactly as it was. The next turn reads the context uncached once.

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

Focus the pane with `ctrl+x tab`, then press `m` to swap the monster, `c` to swap the color, and `d` for the diet. `ctrl+x x` closes the pane. Or name them:

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

Mods are not sandboxed, so read the code before you install any mod. Here is everything this one sees:

- **The model's response stream**, as it arrives, for the main conversation and every subagent: text, thinking, and the arguments of each tool call. It measures their length to animate the monster and keeps nothing.
- **The text of each prompt you send**, and **each tool result**, subagents' included, measured the same way.
- **The context, limit and cost figures** Claude Code already shows in its status line.
- **Each tool call's name and its file path, command, URL or prompt**, shown in the readout and kept in the diet's list for the session.
- **Your prompt while you type it**, only to notice that you are typing.
- **The conversation's tool results**, when you open the diet, to list them; and on a diet `/compact`, the conversation, to replace the results you picked.

It stores only your monster and color choice, and sends nothing anywhere: there is no network call in the code.

## License

MIT
