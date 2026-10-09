import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { ConfirmDialog } from "./ui";

/**
 * Vraagt om bevestiging als je met niet-opgeslagen wijzigingen wegnavigeert,
 * en waarschuwt de browser bij sluiten of herladen.
 */
export function UnsavedChangesGuard({ when, children }: { when: boolean; children: React.ReactNode }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!when) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [when]);

  return (
    <ConfirmDialog
      open={blocker.state === "blocked"}
      title="Wijzigingen niet opgeslagen"
      confirmLabel="Verlaten zonder opslaan"
      destructive
      onConfirm={() => blocker.proceed?.()}
      onClose={() => blocker.reset?.()}
    >
      {children}
    </ConfirmDialog>
  );
}
