/**
 * "Open the skills directory" across DSH releases.
 *
 * The capability rides two different carriers. DSH ≤0.1.4 published it on the
 * connection facade (`connection.hostDescription.canOpenPath` for the answer,
 * `connection.api.host.openPath()` for the gesture). From 0.1.5 that facade is
 * gone and the current release answers the same question over the session
 * Remote instead — `remote.session.canOpenWorkspacePath()` /
 * `openWorkspacePath({ path })` — where only the Host desktop can answer.
 *
 * Both are probed structurally: neither carrier is compiled against, so the
 * plugin keeps one code path and each deployment uses what it has.
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { SkillsManagerApi } from './api.ts'

/** Reply of one DSH ≥0.1.7 session Remote path gesture. */
export interface PathGestureReply {
  /** Whether the Host accepted the gesture. */
  readonly ok?: boolean
  /** The Host's answer for the availability question. */
  readonly value?: boolean
}

/** The `remote.session` namespace of DSH ≥0.1.7, as this plugin consumes it. */
export interface SessionPathRemote {
  canOpenWorkspacePath?: () => Promise<PathGestureReply | undefined>
  openWorkspacePath?: (request: { path: string }) => Promise<PathGestureReply | undefined>
}

/** The ≤0.1.4 `connection.api.host.openPath` signature. */
type LegacyHostOpenPath = (request: { path: string }) => Promise<{ result?: { ok?: boolean; error?: { message?: string } } } | undefined>

/** The ≤0.1.4 connection facade, reached structurally because no current release declares it. */
function legacyHost(connection: unknown): { openPath?: LegacyHostOpenPath } | undefined {
  return (connection as { api?: { host?: { openPath?: LegacyHostOpenPath } } } | undefined)?.api?.host
}

/**
 * Whether this deployment can open the skills directory in the OS file manager.
 *
 * The remote carrier answers only the Host desktop can give; the legacy carrier
 * answers synchronously from a snapshot the shell already publishes. A loopback
 * transport is required either way: a remote browser has no Host filesystem to
 * show.
 * @param connection - the client transport handle.
 * @param description - legacy host facts, when this release publishes them.
 * @param session - the ≥0.1.7 session Remote namespace, when this release mounts it.
 * @returns whether to offer the control; failures read as "no".
 */
export async function canOpenSkillsDirectory(
  connection: Pick<ConnectionHandle, 'isLoopback'> | undefined,
  description: { canOpenPath?: boolean } | undefined,
  session: SessionPathRemote | undefined,
): Promise<boolean> {
  if (connection?.isLoopback !== true) return false
  if (typeof session?.canOpenWorkspacePath === 'function') {
    try {
      const reply = await session.canOpenWorkspacePath()
      return reply?.ok === true && reply.value === true
    } catch {
      return false
    }
  }
  return description?.canOpenPath === true
}

/**
 * Resolve the fixed directory through the Host API, then hand it to whichever
 * opener this release carries.
 * @param api - the plugin Host API; its directory call takes no path input.
 * @param connection - the client transport handle (legacy carrier).
 * @param session - the ≥0.1.7 session Remote namespace.
 * @returns the directory that was opened.
 * @throws when this release carries no opener, or the Host refuses the gesture.
 */
export async function openSkillsDirectory(
  api: Pick<SkillsManagerApi, 'skillsDirectory'>,
  connection: unknown,
  session: SessionPathRemote | undefined,
): Promise<string> {
  const { directory } = await api.skillsDirectory()
  if (typeof session?.openWorkspacePath === 'function') {
    const reply = await session.openWorkspacePath({ path: directory })
    if (reply?.ok !== true) throw new Error('the Host refused to open the skills directory')
    return directory
  }
  const host = legacyHost(connection)
  if (host?.openPath === undefined) throw new Error('this DSH release has no way to open a Host path')
  const result = await host.openPath({ path: directory })
  if (result?.result?.ok !== true) throw new Error(result?.result?.error?.message ?? 'the Host refused to open the skills directory')
  return directory
}