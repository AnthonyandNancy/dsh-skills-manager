import type { ReactElement } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { SKILLS_MANAGER_NS } from './locale.ts';
export interface SkillActionsProps {
    t: TranslateNS<typeof SKILLS_MANAGER_NS>;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    disabled?: boolean;
}
/** Compact row actions: one stable-width trigger and a DSH-native menu. */
export declare function SkillActions({ t, onView, onEdit, onDelete, disabled }: SkillActionsProps): ReactElement;
//# sourceMappingURL=SkillActions.d.ts.map