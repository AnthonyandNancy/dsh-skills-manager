import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { SkillsManagerApi } from './api.ts'

export function canOpenSkillsDirectory(
  connection: Pick<ConnectionHandle, 'isLoopback'> | undefined,
  description: { canOpenPath?: boolean } | undefined,
): boolean {
  return connection?.isLoopback === true && description?.canOpenPath === true
}

/** Resolve the fixed directory through the Host API, then use DSH's opener. */
export async function openSkillsDirectory(api: Pick<SkillsManagerApi, 'skillsDirectory'>, connection: Pick<ConnectionHandle, 'api'>): Promise<string> {
  const { directory } = await api.skillsDirectory()
  const result = await connection.api.host.openPath({ path: directory })
  if (!result.result.ok) throw new Error(result.result.error.message)
  return directory
}
