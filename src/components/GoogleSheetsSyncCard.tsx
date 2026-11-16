import React, { useState } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  UploadCloud,
  ExternalLink,
  UserPlus,
  Users,
  CheckCircle2,
  AlertCircle,
  Link2,
  LogOut,
  Database,
  Loader2,
  ArrowRightLeft,
} from 'lucide-react';
import { CloudUserProfile, DATABASE_SPREADSHEET_TITLE, normalizeUserKey } from '../utils/sheets-mapper';
import { SpreadsheetSummary } from '../utils/sheets-db';

interface GoogleSheetsSyncCardProps {
  activeUsuario: string;
  googleUserEmail: string | null;
  googleUserName: string | null;
  needsAuth: boolean;
  isAuthenticating: boolean;
  isSyncing: boolean;
  spreadsheet: SpreadsheetSummary | null;
  allUsers: CloudUserProfile[];
  isNewCloudUser: boolean;
  hasPendingChanges: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  onGoogleSignIn: () => void;
  onGoogleLogout: () => void;
  onRequestCreateSpreadsheet: () => void;
  onLinkSpreadsheetByInput: (input: string) => void;
  onSearchDriveSpreadsheet: () => void;
  onDownloadFromSheets: () => void;
  onRequestUploadToSheets: () => void;
  onSwitchUsuario: (nextUsuario: string) => void;
  onOpenCredentialsModal: () => void;
  maxWidthClass?: string;
}

export const GoogleSheetsSyncCard: React.FC<GoogleSheetsSyncCardProps> = ({
  activeUsuario,
  googleUserEmail,
  googleUserName,
  needsAuth,
  isAuthenticating,
  isSyncing,
  spreadsheet,
  allUsers,
  isNewCloudUser,
  hasPendingChanges,
  lastSyncedAt,
  syncError,
  onGoogleSignIn,
  onGoogleLogout,
  onRequestCreateSpreadsheet,
  onLinkSpreadsheetByInput,
  onSearchDriveSpreadsheet,
  onDownloadFromSheets,
  onRequestUploadToSheets,
  onSwitchUsuario,
  onOpenCredentialsModal,
  maxWidthClass = 'max-w-3xl',
}) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);

  const normalizedActive = normalizeUserKey(activeUsuario);
  const otherRegisteredUsers = allUsers.filter((u) => u.usuario !== normalizedActive);

  const handleSubmitLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInputValue.trim()) return;
    onLinkSpreadsheetByInput(linkInputValue.trim());
    setLinkInputValue('');
    setShowLinkInput(false);
  };

  return (
    <section
      aria-label="Banco de Dados Online Google Sheets"
      className={`w-full ${maxWidthClass} pf-surface border pf-border rounded-2xl p-4 sm:p-5 shadow-md backdrop-blur-md space-y-3.5 transition-colors duration-200`}
    >
      {/* Top Row: Status + Active Employee Account Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`p-2.5 rounded-xl border shrink-0 ${
              !needsAuth && spreadsheet
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'pf-bg-accent-soft pf-text-accent pf-border-accent'
            }`}
          >
            {needsAuth ? <CloudOff className="w-5 h-5" /> : <Database className="w-5 h-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight">
                Banco de Dados Online • Google Sheets
              </h2>

              {!needsAuth && spreadsheet ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Conectado</span>
                </span>
              ) : needsAuth ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md pf-bg-accent-soft pf-text-accent border pf-border-accent">
                  <span>Aguardando Login Google</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md pf-bg-accent-soft pf-text-accent border pf-border-accent">
                  <span>Planilha não vinculada</span>
                </span>
              )}
            </div>

            <p className="text-[11px] pf-text-muted mt-0.5 leading-snug sm:truncate">
              {needsAuth
                ? 'Entre com Google para salvar e acessar suas batidas e banco de horas em qualquer celular.'
                : googleUserEmail
                  ? `Conta Google: ${googleUserName ? `${googleUserName} (${googleUserEmail})` : googleUserEmail}`
                  : 'Conectado ao Google Workspace'}
            </p>
          </div>
        </div>

        {/* Active Pernambucanas User Pill & Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {normalizedActive ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserPicker((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold pf-surface-muted border pf-border hover:opacity-90 cursor-pointer"
                title="Trocar usuário / CPF Pernambucanas para carregar ou cadastrar outro perfil"
              >
                <Users className="w-3.5 h-3.5 pf-text-accent" />
                <span className="font-mono">{normalizedActive}</span>
                <ArrowRightLeft className="w-3 h-3 pf-text-muted" />
              </button>

              {showUserPicker && (
                <div className="absolute right-0 mt-2 w-64 pf-surface border pf-border rounded-2xl shadow-2xl p-3 z-50 space-y-2">
                  <div className="text-[11px] font-bold pf-text-muted uppercase tracking-wider">
                    Perfis neste Banco ({allUsers.length || 1})
                  </div>

                  {otherRegisteredUsers.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {otherRegisteredUsers.map((u) => (
                        <button
                          key={u.usuario}
                          type="button"
                          onClick={() => {
                            setShowUserPicker(false);
                            onSwitchUsuario(u.usuario);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl pf-surface-muted border pf-border hover:pf-border-accent text-left text-xs cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="font-mono font-bold truncate">{u.usuario}</div>
                            <div className="text-[10px] pf-text-muted">
                              {u.totalBatidas} batidas • {u.saldoTotalFormatado}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserPicker(false);
                      onOpenCredentialsModal();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold pf-btn-accent cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Entrar com Outro Usuário / CPF</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenCredentialsModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold pf-btn-accent cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Definir Usuário / CPF</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {syncError && (
        <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{syncError}</span>
        </div>
      )}

      {/* State 1: Needs Google Sign-In */}
      {needsAuth ? (
        <div className="pf-surface-muted border pf-border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 text-xs">
            <p className="font-bold pf-text-secondary">
              Sincronize seus pontos e banco de horas na nuvem
            </p>
            <p className="text-[11px] pf-text-muted">
              Ao entrar com outro CPF/usuário, um campo novo é criado automaticamente na planilha{' '}
              <span className="font-semibold pf-text-secondary">{DATABASE_SPREADSHEET_TITLE}</span>.
            </p>
          </div>

          <button
            type="button"
            disabled={isAuthenticating}
            onClick={onGoogleSignIn}
            className="gsi-material-button shrink-0"
          >
            <div className="gsi-material-button-state" />
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  style={{ display: 'block' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {isAuthenticating ? 'Conectando...' : 'Entrar com Google'}
              </span>
            </div>
          </button>
        </div>
      ) : !spreadsheet ? (
        /* State 2: Authenticated, needs Spreadsheet setup or link */
        <div className="pf-surface-muted border pf-border rounded-xl p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs space-y-0.5">
              <p className="font-bold">Crie ou conecte sua planilha de banco de dados</p>
              <p className="text-[11px] pf-text-muted">
                Organizada automaticamente com abas <strong>Usuarios</strong>,{' '}
                <strong>Batidas</strong> e <strong>BancoDeHoras</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isSyncing}
                onClick={onSearchDriveSpreadsheet}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold pf-surface border pf-border hover:opacity-90 cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5 pf-text-accent" />}
                <span>Procurar no Drive</span>
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={onRequestCreateSpreadsheet}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold pf-btn-accent cursor-pointer disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Criar Planilha Banco de Dados</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t pf-border text-[11px]">
            <button
              type="button"
              onClick={() => setShowLinkInput((v) => !v)}
              className="inline-flex items-center gap-1 pf-text-accent font-semibold hover:underline cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Já tenho o link/ID da planilha em outro celular</span>
            </button>
            <button
              type="button"
              onClick={onGoogleLogout}
              className="inline-flex items-center gap-1 pf-text-muted hover:text-red-500 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair do Google</span>
            </button>
          </div>

          {showLinkInput && (
            <form onSubmit={handleSubmitLink} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={linkInputValue}
                onChange={(e) => setLinkInputValue(e.target.value)}
                placeholder="Cole o link https://docs.google.com/spreadsheets/d/... ou o ID"
                className="flex-1 px-3 py-2 rounded-xl pf-surface border pf-border text-xs pf-ring-accent"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl text-xs font-bold pf-btn-accent cursor-pointer shrink-0"
              >
                Conectar
              </button>
            </form>
          )}
        </div>
      ) : (
        /* State 3: Fully Connected to Spreadsheet */
        <div className="pf-surface-muted border pf-border rounded-xl p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-1 text-xs min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold truncate max-w-[260px]">{spreadsheet.title}</span>
                {isNewCloudUser ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md pf-bg-accent-soft pf-text-accent border pf-border-accent">
                    Novo usuário: será criado na planilha ao salvar
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    Usuário cadastrado ({allUsers.length}{' '}
                    {allUsers.length === 1 ? 'usuário no banco' : 'usuários no banco'})
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] pf-text-muted">
                <span>
                  {lastSyncedAt
                    ? `Última sincronização: ${lastSyncedAt}`
                    : 'Pronto para sincronizar com a nuvem'}
                </span>
                {hasPendingChanges && (
                  <span className="font-bold pf-text-accent">
                    • Alterações locais pendentes para enviar
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isSyncing}
                onClick={onDownloadFromSheets}
                title="Buscar batidas e escala atualizadas do Google Sheets"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold pf-surface border pf-border hover:opacity-90 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 pf-text-accent ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Baixar do Sheets</span>
              </button>

              <button
                type="button"
                disabled={isSyncing || !normalizedActive}
                onClick={onRequestUploadToSheets}
                title="Salvar usuário, batidas e saldo do Banco de Horas no Google Sheets"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold pf-btn-accent cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                <span>
                  {isNewCloudUser
                    ? 'Cadastrar Usuário no Sheets'
                    : hasPendingChanges
                      ? 'Salvar Alterações no Sheets'
                      : 'Sincronizar no Sheets'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t pf-border text-[11px]">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={spreadsheet.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold pf-text-accent hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir Planilha no Google Sheets</span>
              </a>
              <button
                type="button"
                onClick={() => setShowLinkInput((v) => !v)}
                className="inline-flex items-center gap-1 pf-text-muted hover:pf-text-accent cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Trocar planilha vinculada</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onGoogleLogout}
              className="inline-flex items-center gap-1 pf-text-muted hover:text-red-500 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Desconectar Google</span>
            </button>
          </div>

          {showLinkInput && (
            <form onSubmit={handleSubmitLink} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={linkInputValue}
                onChange={(e) => setLinkInputValue(e.target.value)}
                placeholder="Cole o link ou ID de outra planilha do Google Sheets"
                className="flex-1 px-3 py-2 rounded-xl pf-surface border pf-border text-xs pf-ring-accent"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl text-xs font-bold pf-btn-accent cursor-pointer shrink-0"
              >
                Vincular
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
};
