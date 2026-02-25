import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const InstallApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    document.title = "Install LedgerDR App";

    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone || iosStandalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const isInstallable = !!deferredPrompt && !isInstalled && !isStandalone;

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-xl border border-border bg-card p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Install LedgerDR</h1>

        {isStandalone || isInstalled ? (
          <p className="text-muted-foreground">LedgerDR is already installed on this device.</p>
        ) : isInstallable ? (
          <>
            <p className="text-muted-foreground">
              Your device is ready. Tap the button below to install LedgerDR.
            </p>
            <button
              onClick={handleInstall}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Install app
            </button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              If the install button is unavailable, open Chrome menu (⋮) and select <strong>Install app</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Tip: refresh once and interact with the page for a few seconds before checking the menu.
            </p>
          </>
        )}
      </section>
    </main>
  );
};

export default InstallApp;
