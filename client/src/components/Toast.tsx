import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ErrorRounded from "@mui/icons-material/ErrorRounded";
import { Box, Slide, Snackbar } from "@mui/material";
import { type ReactNode, createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; message: string; tone: "success" | "error" };

const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

/** Bevestiging van een actie, onderaan gecentreerd ("Maand opgeslagen"). */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToast({ id: Date.now(), message, tone });
    setOpen(true);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Snackbar
        key={toast?.id}
        open={open}
        autoHideDuration={toast?.tone === "error" ? 5000 : 2400}
        onClose={(_event, reason) => reason !== "clickaway" && setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        slots={{ transition: Slide }}
        slotProps={{ transition: { direction: "up" } as object }}
        sx={{ bottom: { xs: 88, sm: 32 } }}
        message={
          <Box sx={{ display: "flex", alignItems: "center", gap: 3, fontWeight: 500 }}>
            {toast?.tone === "error" ? (
              <ErrorRounded aria-hidden sx={{ color: "#F0817A" }} />
            ) : (
              <CheckCircleRounded aria-hidden sx={{ color: "#5BC48A" }} />
            )}
            {toast?.message}
          </Box>
        }
      />
    </ToastContext.Provider>
  );
}
