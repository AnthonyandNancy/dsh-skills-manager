/**
 * Skills Manager JSON API (host).
 *
 * Registered as an exact Fetch route on DSH's shared `/api` channel: that is
 * the one browser API carrier every shipped composition dispatches — the Web
 * profile's fenced `/api` route and the Electron desktop shell's IPC bridge
 * alike — and it is where DSH applies its own Host/Origin trust fence plus
 * browser-session authentication (see `@deepseek-ai/dsh-client-connection`).
 * The plugin therefore owns no transport, no bind, and no request-trust policy
 * of its own; it only answers the one POST route it declares.
 *
 * The API itself is the thin management API used by the Settings → Skills UI.
 * It calls DSH's native Skills registry and DSH-managed skill directories; it
 * never reimplements skill runtime behavior.
 */
import type { MetadataStore } from './storage.ts';
/** Absolute path of the single POST route this plugin owns below `/api`. */
export declare const API_PATH = "/api/skills-manager";
interface RouteServices {
    readonly ctx: any;
    readonly metadata: MetadataStore;
    readonly dshHome?: string;
}
/** Register the Skills Manager JSON API on DSH's shared `/api` Fetch registry. */
export declare function installRoutes(services: RouteServices): void;
export {};
