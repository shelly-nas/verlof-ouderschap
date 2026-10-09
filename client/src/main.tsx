import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter, useLocation } from "react-router-dom";
import { ThemeModeProvider } from "./ThemeModeProvider";
import { AppShell } from "./components/AppShell";
import { ToastProvider } from "./components/Toast";
import { ChildrenPage } from "./pages/ChildrenPage";
import { ContractFormPage } from "./pages/ContractFormPage";
import { ContractsPage } from "./pages/ContractsPage";
import { MailPage } from "./pages/MailPage";
import { MonthPage } from "./pages/MonthPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SalaryPage } from "./pages/SalaryPage";
import { BalancesPage } from "./pages/BalancesPage";
import { SettingsPage } from "./pages/SettingsPage";

/** /mail was de oude naam van /melden; bestaande bladwijzers blijven werken. */
function MailRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/melden${search}`} replace />;
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "maand", element: <MonthPage /> },
      { path: "maand/:maand", element: <MonthPage /> },
      { path: "saldo", element: <BalancesPage /> },
      { path: "salaris", element: <SalaryPage /> },
      { path: "melden", element: <MailPage /> },
      { path: "mail", element: <MailRedirect /> },
      { path: "contracten", element: <ContractsPage /> },
      { path: "contracten/nieuw", element: <ContractFormPage /> },
      { path: "contracten/:id", element: <ContractFormPage /> },
      { path: "kinderen", element: <ChildrenPage /> },
      { path: "instellingen", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeModeProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ThemeModeProvider>
  </StrictMode>,
);
