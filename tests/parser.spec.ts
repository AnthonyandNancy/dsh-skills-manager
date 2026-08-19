import { describe, expect, it } from 'vitest'
import { parseSkillFrontmatter, serializeSkillFile, splitFrontmatter } from '../src/import/parser.ts'

describe('parser', () => {
  it('parses simple frontmatter', () => {
    const parsed = parseSkillFrontmatter('---\nname: systematic-debugging\ndescription: Debug systematically\n---\n\nBody here\n')
    expect(parsed).toEqual({ name: 'systematic-debugging', description: 'Debug systematically' })
  })

  it('parses quoted values', () => {
    const parsed = parseSkillFrontmatter('---\nname: "foo-bar"\ndescription: \'A skill\'\n---\n')
    expect(parsed).toEqual({ name: 'foo-bar', description: 'A skill' })
  })

  it('returns undefined without frontmatter', () => {
    expect(parseSkillFrontmatter('# Just markdown')).toBeUndefined()
  })

  it('serializes a DSH-compatible file', () => {
    const raw = serializeSkillFile({ name: 'foo', description: 'A "skill"', body: 'Do stuff' })
    const parsed = parseSkillFrontmatter(raw)
    expect(parsed?.name).toBe('foo')
    expect(parsed?.description).toBe('A "skill"')
    expect(raw).toContain('Do stuff')
  })

  it('splits body correctly', () => {
    const split = splitFrontmatter('---\na: 1\n---\nBody\n')
    expect(split?.data).toContain('a: 1')
    expect(split?.body).toBe('Body\n')
  })
})
