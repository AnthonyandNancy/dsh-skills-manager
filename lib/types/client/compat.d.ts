/** Runtime capability checks for DSH client services across releases. */
import type { ComponentType } from 'react';
export declare function hasMethod<T extends object>(value: T | undefined, method: string): boolean;
export interface HostDescriptionSourceLike {
    getSnapshot?: () => unknown;
    subscribe?: (listener: () => void) => () => void;
}
/**
 * Read the ≤0.1.4 host-description source off a connection whose current type
 * no longer declares it. Current releases answer the same questions elsewhere.
 * @param connection - the client transport handle.
 * @returns the snapshot source when this release publishes one.
 */
export declare function hostDescriptionSourceOf(connection: unknown): HostDescriptionSourceLike | undefined;
export interface HostDescriptionLike {
    canOpenPath?: boolean;
}
export declare function readHostDescription(source: HostDescriptionSourceLike | undefined): HostDescriptionLike | undefined;
export declare function subscribeHostDescription(source: HostDescriptionSourceLike | undefined, listener: () => void): (() => void) | undefined;
/** `ctx.connection.state` as an observable source (DSH ≥ 0.1.5). */
export interface ConnectionStateSourceLike {
    getSnapshot?: () => unknown;
    subscribe?: (listener: () => void) => () => void;
}
/** The transport lifecycle states the covered DSH releases report. */
export type ConnectionStateLike = 'connected' | 'connecting' | 'disconnected';
export declare function connectionStateSource(connection: unknown): ConnectionStateSourceLike | undefined;
/** Current transport state, or `undefined` before the first outcome and on releases without the source. */
export declare function readConnectionState(source: ConnectionStateSourceLike | undefined): ConnectionStateLike | undefined;
export declare function subscribeConnectionState(source: ConnectionStateSourceLike | undefined, listener: () => void): (() => void) | undefined;
/**
 * Whether a request failed because the transport itself is not usable right
 * now. Only releases that report a state can answer: without the source the
 * caller must treat every failure as a real one, or a broken backend would be
 * reported as an eternal "reconnecting".
 */
export declare function transportUnavailable(connection: unknown): boolean;
/** One UI Primitive icon component, as the plugin consumes it. */
export type IconComponent = ComponentType<{
    className?: string;
}>;
/**
 * Resolve the chevron-down glyph across DSH releases.
 *
 * 0.1.5 shipped a size-suffixed set (`IconChevronDownOutline14`, 14px filled
 * artwork); 0.1.7 replaced it with a two-weight set drawn on a 16px grid. The
 * kit is imported as a namespace and probed at runtime because a named import
 * of either generation is `undefined` — and a type error — on the other. The
 * seat is decorative: a release that ships none renders without it.
 * @param primitives - the UI primitives module object.
 * @returns the first chevron-down icon this release provides, or `undefined`.
 */
export declare function resolveChevronDownIcon(primitives: unknown): IconComponent | undefined;
export declare function isClientContextCompatible(ctx: unknown): boolean;
//# sourceMappingURL=compat.d.ts.map