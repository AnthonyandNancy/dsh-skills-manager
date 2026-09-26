/** Settings → Skills management surface over DSH's native Skills API. */
import type { ReactElement } from 'react';
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { SkillsManagerApi } from './api.ts';
import { type SessionPathRemote } from './open-skills-folder.ts';
import { SKILLS_MANAGER_NS } from './locale.ts';
export interface SkillsSectionInjected {
    api: SkillsManagerApi;
    connection?: ConnectionHandle;
    remote?: {
        $on?: (event: string, listener: () => void) => () => void;
        session?: SessionPathRemote;
    };
}
export interface SkillsSectionProps extends SkillsSectionInjected {
    close: () => void;
    t: TranslateNS<typeof SKILLS_MANAGER_NS>;
}
export declare function SkillsSection(props: SkillsSectionProps): ReactElement;
//# sourceMappingURL=SkillsSection.d.ts.map