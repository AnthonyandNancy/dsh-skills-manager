/**
 * Scope picker for the skill editor: `global` or `project`.
 *
 * Composition follows DSH's own settings-side permission selector
 * (ui-permission-presets PermissionRow): a plain button trigger carrying
 * `aria-haspopup`/`aria-expanded` plus the shared chevron glyph, anchoring a
 * `Menu` whose `selectedId` draws the native check mark. Keyboard, Escape and
 * outside-click dismissal all belong to the primitive.
 */
import type { ReactElement } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { SKILLS_MANAGER_NS } from './locale.ts';
/** The two scopes a managed skill can live in. */
export type SkillScope = 'global' | 'project';
export interface ScopeSelectProps {
    value: SkillScope;
    onChange: (value: SkillScope) => void;
    disabled?: boolean;
    t: TranslateNS<typeof SKILLS_MANAGER_NS>;
}
export declare function ScopeSelect({ value, onChange, disabled, t }: ScopeSelectProps): ReactElement;
//# sourceMappingURL=ScopeSelect.d.ts.map