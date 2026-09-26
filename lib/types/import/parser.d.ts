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
    readonly name?: string;
    readonly description?: string;
    readonly whenToUse?: string;
}
/** Split a markdown file into YAML frontmatter block and body, if present. */
export declare function splitFrontmatter(raw: string): {
    data: string;
    body: string;
} | undefined;
/**
 * Parse only the top-level scalar fields DSH needs for skill discovery.
 * Unknown fields are ignored; malformed YAML that still contains the required
 * fields is accepted here, but DSH's own parser is the final authority after
 * import.
 */
export declare function parseSkillFrontmatter(raw: string): ParsedSkillFrontmatter | undefined;
/** Serialize a DSH-compatible SKILL.md from management fields. */
export declare function serializeSkillFile(input: {
    name: string;
    description: string;
    whenToUse?: string;
    body: string;
}): string;
