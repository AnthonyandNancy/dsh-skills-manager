/**
 * dsh-skills-manager — DSH native Skills visual manager + manual external importer.
 *
 * Host half responsibilities:
 * 1. Register the thin `/api/skills-manager` JSON API used by the Settings →
 *    Skills UI on DSH's shared `/api` Fetch channel.
 * 2. External imports are manual only: the Settings UI's Scan External Skills
 *    action invokes `import.scan`. Loading this plugin never scans or imports
 *    Claude/Codex/Cursor/Gemini skill roots.
 *
 * This plugin never replaces DSH's Skill Registry/Loader/Runtime. It only
 * reads through `ctx.skills` and writes into DSH-managed skill directories.
 */
import z from '@deepseek-ai/schemastery';
export declare const name = "dsh-skills-manager";
export declare const inject: string[];
export interface Config {
    /** DSH home override; defaults to $DSH_HOME or ~/.dsh. */
    dshHome?: string;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    dshHome: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    dshHome: z<string, string, "defined">;
}>>, "plain">;
export declare function apply(ctx: any, config?: Config): void;
declare const _default: {
    name: string;
    apply: typeof apply;
};
export default _default;
