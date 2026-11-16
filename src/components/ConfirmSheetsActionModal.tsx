import React from 'react';
import { AlertTriangle, FileSpreadsheet, Loader2, ShieldCheck, X } from 'lucide-react';

export interface SheetsConfirmDialogState {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'accent' | 'danger';
  spreadsheetName?: string;
  targetUser?: string;
  affectedSummary?: string[];
  onConfirm: () => Promise<void> | void;
}

interface ConfirmSheetsActionModalProps {
  dialog: SheetsConfirmDialogState | null;
  isProcessing: boolean;
  onCancel: () => void;
}

export const ConfirmSheetsActionModal: React.FC<ConfirmSheetsActionModalProps> = ({
  dialog,
  isProcessing,
  onCancel,
}) => {
  if (!dialog) return null;

  const isDanger = dialog.variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheets-confirm-title"
    >
      <div className="w-full max-w-md pf-surface border pf-border rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isDanger
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                  : 'pf-bg-accent-soft pf-text-accent pf-border-accent'
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <FileSpreadsheet className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 id="sheets-confirm-title" className="text-base font-extrabold tracking-tight">
                {dialog.title}
              </h3>
              <p className="text-[11px] pf-text-muted">Confirmação obrigatória • Google Sheets</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={onCancel}
            aria-label="Fechar diálogo de confirmação"
            className="p-1.5 rounded-lg pf-surface-muted border pf-border pf-text-muted hover:opacity-80 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs pf-text-secondary leading-relaxed">{dialog.description}</p>

        <div className="pf-surface-muted border pf-border rounded-xl p-3.5 space-y-2 text-xs">
          {dialog.spreadsheetName && (
            <div className="flex items-center justify-between gap-2">
              <span className="pf-text-muted">Planilha:</span>
              <span className="font-bold truncate max-w-[230px]">{dialog.spreadsheetName}</span>
            </div>
          )}
          {dialog.targetUser && (
            <div className="flex items-center justify-between gap-2">
              <span className="pf-text-muted">Usuário vinculado:</span>
              <span className="font-mono font-bold pf-text-accent">{dialog.targetUser}</span>
            </div>
          )}
          {dialog.affectedSummary && dialog.affectedSummary.length > 0 && (
            <div className="pt-1.5 border-t pf-border space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider pf-text-muted block">
                O que será gravado/alterado:
              </span>
              <ul className="space-y-1">
                {dialog.affectedSummary.map((line, i) => (
                  <li key={i} className="text-[11px] pf-text-secondary flex items-start gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 pf-text-accent shrink-0 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold pf-surface-muted border pf-border pf-text-secondary hover:opacity-90 cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={dialog.onConfirm}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer disabled:opacity-60 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                : 'pf-btn-accent'
            }`}
          >
            {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isProcessing ? 'Executando...' : dialog.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
