import type { CSSProperties, ReactNode, ReactElement } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { SKILLS_MANAGER_NS } from './locale.ts';
export interface ExpandableTextProps {
    children: ReactNode;
    t: TranslateNS<typeof SKILLS_MANAGER_NS>;
    collapsedLines?: number;
    className?: string;
    style?: CSSProperties;
}
/** Text that clamps to two lines and expands only when it really overflows. */
export declare function ExpandableText({ children, t, collapsedLines, className, style }: ExpandableTextProps): ReactElement;
//# sourceMappingURL=ExpandableText.d.ts.map