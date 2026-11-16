import React, { useState, useEffect } from 'react';
import { Smartphone, X, Apple } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isAppleDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  if (isInstalled || (!deferredPrompt && !isIOS)) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title="Instalar aplicativo no celular para receber notificações na tela bloqueada"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 pf-bg-accent-soft hover:opacity-90 border pf-border-accent pf-text-accent rounded-lg text-xs font-bold transition active:scale-95 shadow-sm cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Instalar no Celular</span>
      </button>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm pf-surface border pf-border rounded-2xl p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 pf-text-muted hover:opacity-80 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 pf-surface-muted rounded-xl pf-text-accent">
                <Apple className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold">Instalar no iPhone / iPad</h3>
                <p className="text-xs pf-text-muted">Notificações diretas na tela</p>
              </div>
            </div>

            <ol className="space-y-3 text-xs pf-text-secondary leading-relaxed pf-surface-muted p-4 rounded-xl border pf-border">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full pf-bg-accent font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <span>
                  Toque no botão <strong>Compartilhar</strong> na barra inferior do Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full pf-bg-accent font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <span>
                  Toque em <strong>"Adicionar à Tela de Início"</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full pf-bg-accent font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <span>
                  Toque em <strong>Adicionar</strong> para abrir em tela cheia!
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full py-2.5 pf-btn-accent font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};
