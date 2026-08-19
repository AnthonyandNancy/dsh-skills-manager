/**
 * Minimal SKILL.md frontmatter parser.
 *
 * This is intentionally not a second Skill Runtime. It only extracts the same
 * top-level fields DSH's native `dsh-skill-filesystem` provider consumes
 * (`name`, `description`, optional `whenToUse`) so the importer can normalize
 * and deduplicate external candidates. The full SKILL.md file is copied
 * verbatim into DSH's managed skills directory; DSH remains the parser and
 * runtime owner.
 */

export interface ParsedSkillFrontmatter {
  readonly name?: string
  readonly description?: string
  readonly whenToUse?: string
}

/** Split a markdown file into YAML frontmatter block and body, if present. */
export function splitFrontmatter(raw: string): { data: string; body: string } | undefined {
  const firstLineEnd = raw.indexOf('\n')
  if (firstLineEnd < 0) return undefined
  const firstLine = raw.slice(0, firstLineEnd).replace(/\r$/, '')
  if (firstLine !== '---') return undefined
  const start = firstLineEnd + 1
  let lineStart = start
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf('\n', lineStart)
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline
    const line = raw.slice(lineStart, lineEnd).replace(/\r$/, '')
    if (line === '---') {
      return {
        data: raw.slice(start, lineStart),
        body: nextNewline < 0 ? '' : raw.slice(nextNewline + 1),
      }
    }
    if (nextNewline < 0) return undefined
    lineStart = nextNewline + 1
  }
  return undefined
}

function unquoteScalar(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = trimmed.slice(1, -1)
      if (first === '"') {
        return inner.replaceAll('\\"', '"').replaceAll('\\\\', '\\')
      }
      return inner.replaceAll("''", "'")
    }
  }
  return trimmed
}

/**
 * Parse only the top-level scalar fields DSH needs for skill discovery.
 * Unknown fields are ignored; malformed YAML that still contains the required
 * fields is accepted here, but DSH's own parser is the final authority after
 * import.
 */
export function parseSkillFrontmatter(raw: string): ParsedSkillFrontmatter | undefined {
  const split = splitFrontmatter(raw)
  if (split === undefined) return undefined
  const out: { name?: string; description?: string; whenToUse?: string } = {}
  let currentKey: keyof ParsedSkillFrontmatter | undefined
  let currentLines: string[] | undefined

  const flush = (): void => {
    if (currentKey !== undefined && currentLines !== undefined) {
      const value = currentLines.join('\n').trim()
      if (value.length > 0 && (currentKey === 'name' || currentKey === 'description' || currentKey === 'whenToUse')) {
        out[currentKey] = value
      }
    }
    currentKey = undefined
    currentLines = undefined
  }

  for (const rawLine of split.data.split(/\r?\n/)) {
    const line = rawLine
    const keyMatch = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line)
    if (keyMatch !== null) {
      flush()
      const key = keyMatch[1] as string
      if (key === 'name' || key === 'description' || key === 'whenToUse' || key === 'when-to-use') {
        currentKey = key === 'when-to-use' ? 'whenToUse' : key
        currentLines = []
        const inline = keyMatch[2] ?? ''
        if (inline.trim().length > 0) currentLines.push(unquoteScalar(inline))
      }
      continue
    }
    if (currentKey !== undefined && currentLines !== undefined) {
      // Continuation lines (block scalars or folded values) are appended.
      if (/^\s|^\S/.test(line)) currentLines.push(line.trim())
    }
  }
  flush()
  return out
}

/** Serialize a DSH-compatible SKILL.md from management fields. */
export function serializeSkillFile(input: {
  name: string
  description: string
  whenToUse?: string
  body: string
}): string {
  const lines = [
    '---',
    `name: ${input.name}`,
    `description: ${JSON.stringify(input.description)}`,
  ]
  if (input.whenToUse !== undefined && input.whenToUse.length > 0) {
    lines.push(`whenToUse: ${JSON.stringify(input.whenToUse)}`)
  }
  lines.push('---', '')
  const body = input.body.trim()
  lines.push(body)
  if (!body.endsWith('\n')) lines.push('')
  return lines.join('\n')
}
