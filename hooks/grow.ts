// It grows up with you. Every token it eats (what heats it up: the stream, tool
// results, prompts) is banked as lifetime experience in $.store, across sessions,
// and its level follows from that. The hooks that bank it are in register.tsx.

// The step from level n to n + 1 takes STEP * n^1.6 tokens: level 2 at 20k, level 3
// at about 80k (an hour or so of work), level 10 at 2.7M, level 25 at about 30M.
const STEP = 20_000
const MAX = 99

const cost = (level: number) => Math.round(STEP * level ** 1.6)

// The tokens it takes to reach `level`.
export const xpFor = (level: number) => {
  let total = 0

  for (let n = 1; n < Math.min(level, MAX); n++) total += cost(n)

  return total
}

export const levelOf = (tokens: number) => {
  let [level, need] = [1, cost(1)]

  while (level < MAX && tokens >= need) {
    level += 1
    need += cost(level)
  }

  return level
}
