import type { ReactElement } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { ImportReport } from './api.ts';
import { SKILLS_MANAGER_NS } from './locale.ts';
export interface ExternalImportViewProps {
    report: ImportReport;
    busy: boolean;
    onBack: () => void;
    onScanAgain: () => void;
    t: TranslateNS<typeof SKILLS_MANAGER_NS>;
}
export declare function ExternalImportView({ report, busy, onBack, onScanAgain, t }: ExternalImportViewProps): ReactElement;
//# sourceMappingURL=ExternalImportView.d.ts.map