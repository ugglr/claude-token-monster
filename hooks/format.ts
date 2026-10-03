// What both modules share: the pane, the words, and the token arithmetic.
export const PANE = 'token-monster'
export const PANE_OPEN = { id: PANE, title: 'Token Monster', columns: 46 }

// `/token-monster diet` or `/token-monster eat`, with anything after it.
export const isDietWord = (args: string) => ['diet', 'eat'].includes(args.trim().toLowerCase().split(/\s+/)[0] ?? '')

// Rough tokens in a piece of text, about four characters each.
export const tokens = (text: string | undefined) => Math.ceil((text?.length ?? 0) / 4)

export const kilo = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 10_000
      ? `${Math.round(n / 1000)}k`
      : n >= 1000
        ? `${(n / 1000).toFixed(1)}k`
        : `${n}`
