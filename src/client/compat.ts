/** Runtime capability checks for DSH client services across releases. */

export function hasMethod<T extends object>(value: T | undefined, method: string): boolean {
  return typeof (value as Record<string, unknown> | undefined)?.[method] === 'function'
}

export interface HostDescriptionSourceLike {
  getSnapshot?: () => unknown
  subscribe?: (listener: () => void) => () => void
}

export interface HostDescriptionLike {
  canOpenPath?: boolean
}

export function readHostDescription(source: HostDescriptionSourceLike | undefined): HostDescriptionLike | undefined {
  return source !== undefined && hasMethod(source, 'getSnapshot') ? source.getSnapshot?.() as HostDescriptionLike | undefined : undefined
}

export function subscribeHostDescription(
  source: HostDescriptionSourceLike | undefined,
  listener: () => void,
): (() => void) | undefined {
  return source !== undefined && hasMethod(source, 'subscribe') ? source.subscribe?.(listener) : undefined
}

export function isClientContextCompatible(ctx: unknown): boolean {
  const value = ctx as {
    locale?: unknown
    slots?: unknown
    effect?: unknown
  } | undefined
  return hasMethod(value?.locale as object | undefined, 'register')
    && hasMethod(value?.locale as object | undefined, 'bind')
    && hasMethod(value?.slots as object | undefined, 'inject')
    && hasMethod(value?.slots as object | undefined, 'register')
    && hasMethod(value, 'effect')
}
