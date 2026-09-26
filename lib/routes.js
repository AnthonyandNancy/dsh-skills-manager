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
import { listManagedSkills, getManagedSkill, createManagedSkill, updateManagedSkill, deleteManagedSkill } from "./skills-service.js";
import { ensureDshSkillsRoot, runExternalImport, reportFromMetadata, auditDshSkillDuplicates } from "./import/importer.js";
import { listConflicts, resolveConflict } from "./import/resolver.js";
/** Absolute path of the single POST route this plugin owns below `/api`. */
export const API_PATH = '/api/skills-manager';
/** Buffered request-body cap; the carrier's own cap is far larger and is not this API's contract. */
const MAX_REQUEST_BYTES = 256 * 1024;
const JSON_HEADERS = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
};
function writeJson(status, body) {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
function error(status, code, message) {
    return writeJson(status, { ok: false, error: { code, message } });
}
function ok(value) {
    return writeJson(200, { ok: true, value });
}
function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : {};
}
function stringField(value) {
    return typeof value === 'string' ? value : undefined;
}
function resolveCwd(payload) {
    const explicit = stringField(payload.cwd);
    if (explicit !== undefined && explicit.length > 0)
        return explicit;
    return undefined;
}
async function readJson(request) {
    const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (contentType !== 'application/json')
        throw new TypeError('Content-Type must be application/json');
    const declared = Number(request.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES)
        throw new TypeError('request body too large');
    const text = await request.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_REQUEST_BYTES)
        throw new TypeError('request body too large');
    return text.length === 0 ? {} : JSON.parse(text);
}
/**
 * Dispatch one request. The carrier has already applied its trust and
 * authentication policy, so this function only parses, routes, and answers.
 * @param services - host services the API reads and writes through.
 * @param request - POST request carrying `{ method, ...args }` as JSON.
 * @returns the JSON envelope response.
 */
async function handle(services, request) {
    let payload;
    try {
        payload = asRecord(await readJson(request));
    }
    catch (err) {
        return error(400, 'bad-request', err instanceof Error ? err.message : String(err));
    }
    const method = stringField(payload.method);
    if (method === undefined)
        return error(400, 'bad-request', 'method is required');
    try {
        // The store may still be loading what the previous run persisted, and every
        // branch below reads or rewrites that state: settle it before dispatch.
        await services.metadata.ready();
        switch (method) {
            case 'skills.directory': {
                // This endpoint deliberately accepts no path. The Host resolves the
                // authoritative DSH home and creates only its native skills root.
                const directory = await ensureDshSkillsRoot(services.dshHome);
                return ok({ directory });
            }
            case 'skills.list': {
                const cwd = resolveCwd(payload);
                let sessionCount = 0;
                try {
                    sessionCount = services.ctx.get?.('sessions')?.list?.()?.length ?? 0;
                }
                catch {
                    sessionCount = 0;
                }
                services.ctx.logger?.info?.('[dsh-skills-manager] skills.list request: cwd=%s sessionCount=%d selectedSession=none liveAgent=none preset=default', cwd ?? '-', sessionCount);
                const skills = await listManagedSkills({ ctx: services.ctx, dshHome: services.dshHome }, cwd);
                return ok({ skills });
            }
            case 'skills.get': {
                const name = stringField(payload.name);
                if (name === undefined)
                    throw new Error('name is required');
                const cwd = resolveCwd(payload);
                const skill = await getManagedSkill({ ctx: services.ctx, dshHome: services.dshHome }, name, cwd);
                return ok({ skill });
            }
            case 'skills.create': {
                const name = stringField(payload.name);
                const description = stringField(payload.description);
                const body = stringField(payload.body);
                const whenToUse = stringField(payload.whenToUse);
                if (name === undefined || description === undefined || body === undefined) {
                    throw new Error('name, description and body are required');
                }
                const scope = stringField(payload.scope) ?? 'global';
                const cwd = scope === 'project' ? resolveCwd(payload) : undefined;
                if (scope === 'project' && cwd === undefined)
                    throw new Error('project scope requires a cwd');
                const skill = await createManagedSkill({ ctx: services.ctx, dshHome: services.dshHome }, { name, description, ...whenToUse === undefined ? {} : { whenToUse }, body });
                return ok({ skill });
            }
            case 'skills.update': {
                const name = stringField(payload.name);
                const description = stringField(payload.description);
                const body = stringField(payload.body);
                const whenToUse = stringField(payload.whenToUse);
                if (name === undefined || description === undefined || body === undefined) {
                    throw new Error('name, description and body are required');
                }
                const cwd = resolveCwd(payload);
                const skill = await updateManagedSkill({ ctx: services.ctx, dshHome: services.dshHome }, { name, description, ...whenToUse === undefined ? {} : { whenToUse }, body }, cwd);
                return ok({ skill });
            }
            case 'skills.delete': {
                const name = stringField(payload.name);
                if (name === undefined)
                    throw new Error('name is required');
                const cwd = resolveCwd(payload);
                await deleteManagedSkill({ ctx: services.ctx, dshHome: services.dshHome }, name, cwd);
                return ok({ deleted: name });
            }
            case 'import.scan': {
                const cwd = resolveCwd(payload);
                const report = await runExternalImport(services, cwd);
                return ok({ report });
            }
            case 'import.meta': {
                const meta = services.metadata.get();
                const report = reportFromMetadata(services.metadata);
                return ok({
                    externalImportCompleted: meta.externalImportCompleted,
                    ...meta.lastScan === undefined ? {} : { lastScanAt: meta.lastScan.finishedAt },
                    ...report === undefined ? {} : { report },
                });
            }
            case 'import.audit': {
                // Report-only diagnostics, requested explicitly: it re-fingerprints
                // every native skill and must never run during normal rendering.
                const cwd = resolveCwd(payload);
                const audit = await auditDshSkillDuplicates(services.ctx, cwd);
                return ok({ audit });
            }
            case 'import.conflicts': {
                const cwd = resolveCwd(payload);
                const rows = await listManagedSkills({ ctx: services.ctx, dshHome: services.dshHome }, cwd);
                const conflicts = listConflicts(services.metadata, rows);
                return ok({ conflicts });
            }
            case 'import.resolve': {
                const name = stringField(payload.name);
                const source = stringField(payload.source);
                if (name === undefined || source === undefined)
                    throw new Error('name and source are required');
                const cwd = resolveCwd(payload);
                await resolveConflict({ ctx: services.ctx, dshHome: services.dshHome }, services.metadata, { name, source }, cwd);
                return ok({ resolved: name });
            }
            default:
                return error(404, 'not-found', `unknown method "${method}"`);
        }
    }
    catch (err) {
        return error(400, 'skills-manager-error', err instanceof Error ? err.message : String(err));
    }
}
/** Register the Skills Manager JSON API on DSH's shared `/api` Fetch registry. */
export function installRoutes(services) {
    const { ctx } = services;
    ctx.inject(['connection'], (connectionCtx) => {
        connectionCtx.effect(() => {
            const connection = connectionCtx.connection;
            if (typeof connection?.fetch?.register !== 'function') {
                connectionCtx.logger?.warn?.('[dsh-skills-manager] this DSH release has no connection Fetch registry; the Skills Manager API stays unregistered');
                return;
            }
            const dispose = connection.fetch.register({
                path: API_PATH,
                methods: ['POST'],
                requestBody: 'buffered',
                fetch: (request) => handle(services, request),
            });
            return () => { void dispose(); };
        }, 'dsh-skills-manager: /api fetch route');
    });
}
//# sourceMappingURL=routes.js.map