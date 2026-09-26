import type { Dispatch, ReactElement, SetStateAction } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { SKILLS_MANAGER_NS } from './locale.ts';
import { type SkillScope } from './ScopeSelect.tsx';
export type EditorDraft = {
    name: string;
    description: string;
    whenToUse: string;
    body: string;
    scope: SkillScope;
};
export declare const EMPTY_DRAFT: EditorDraft;
export interface SkillEditorProps {
    mode: 'create' | 'edit';
    draft: EditorDraft;
    setDraft: Dispatch<SetStateAction<EditorDraft>>;
    selectedName?: string;
    busy: boolean;
    error?: string;
    onCancel: () => void;
    onSave: () => void;
    t: TranslateNS<typeof SKILLS_MANAGER_NS>;
}
export declare function SkillEditor({ mode, draft, setDraft, selectedName, busy, error, onCancel, onSave, t }: SkillEditorProps): ReactElement;
//# sourceMappingURL=SkillEditor.d.ts.map