import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import ChildCareRounded from "@mui/icons-material/ChildCareRounded";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import EuroRounded from "@mui/icons-material/EuroRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import SpaceDashboardRounded from "@mui/icons-material/SpaceDashboardRounded";
import TimelapseRounded from "@mui/icons-material/TimelapseRounded";
import WorkRounded from "@mui/icons-material/WorkRounded";
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type ReactNode, useEffect, useState } from "react";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import { useThemeMode } from "../ThemeModeProvider";
import { useApi } from "../api/client";

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Verlof",
    items: [
      { to: "/", label: "Overzicht", icon: <SpaceDashboardRounded />, end: true },
      { to: "/maand", label: "Maand invoeren", icon: <CalendarMonthRounded /> },
      { to: "/saldo", label: "Saldo", icon: <TimelapseRounded /> },
      { to: "/salaris", label: "Salaris", icon: <EuroRounded /> },
      { to: "/melden", label: "Verlof melden", icon: <SendRounded /> },
    ],
  },
  {
    label: "Gegevens",
    items: [
      { to: "/contracten", label: "Contracten", icon: <WorkRounded /> },
      { to: "/kinderen", label: "Kinderen", icon: <ChildCareRounded /> },
      { to: "/instellingen", label: "Instellingen", icon: <SettingsRounded /> },
    ],
  },
];

const SIDEBAR_WIDTH = 248;

function isActive(pathname: string, item: NavItem): boolean {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function Brand() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
      <Box
        aria-hidden
        sx={{
          width: 32,
          height: 32,
          borderRadius: "8px",
          bgcolor: "primary.main",
          color: "primary.contrastText",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        V
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2, color: "text.primary" }}>
          Verlof
        </Typography>
        <Typography variant="caption" component="p">
          Ouderschapsverlof
        </Typography>
      </Box>
    </Box>
  );
}

function ThemeToggle() {
  const { mode, setPreference } = useThemeMode();
  const next = mode === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Donker thema" : "Licht thema";
  return (
    <ListItemButton onClick={() => setPreference(next)} aria-label={`Wissel naar ${label.toLowerCase()}`}>
      <ListItemIcon sx={{ minWidth: 0, color: "text.secondary" }}>
        {next === "dark" ? <DarkModeRounded /> : <LightModeRounded />}
      </ListItemIcon>
      <ListItemText primary={label} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: "inherit" } } }} />
    </ListItemButton>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const health = useApi<{ version: string }>("/health");

  return (
    <Box
      component="nav"
      aria-label="Hoofdmenu"
      sx={{ display: "flex", flexDirection: "column", height: "100%", px: 4, py: 6, gap: 8 }}
    >
      <Box sx={{ px: 2 }}>
        <Brand />
      </Box>

      {groups.map((group) => (
        <Box key={group.label}>
          <Typography variant="overline" component="p" sx={{ px: 3, mb: 2 }}>
            {group.label}
          </Typography>
          <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <ListItemButton
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  selected={active}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <ListItemIcon sx={{ minWidth: 0, color: active ? "primary.main" : "text.secondary" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{ primary: { sx: { fontSize: 14, fontWeight: "inherit" } } }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      ))}

      <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        <ThemeToggle />
        {health.data?.version && (
          <Typography variant="caption" sx={{ px: 3 }}>
            Versie {health.data.version}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/**
 * App-shell: vaste zijbalk op desktop, een topbalk met menu op mobiel.
 */
export function AppShell() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Na navigeren bovenaan beginnen, zoals bij een gewone paginawissel.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {desktop ? (
        <Box
          sx={{
            width: SIDEBAR_WIDTH,
            flex: "none",
            borderRight: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
          }}
        >
          <Navigation />
        </Box>
      ) : (
        <>
          <Box
            component="header"
            sx={{
              position: "fixed",
              insetInline: 0,
              top: 0,
              zIndex: theme.zIndex.appBar,
              height: 56,
              px: 2,
              display: "flex",
              alignItems: "center",
              gap: 2,
              bgcolor: "background.paper",
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Tooltip title="Menu">
              <IconButton aria-label="Menu openen" onClick={() => setMenuOpen(true)} sx={{ width: 44, height: 44 }}>
                <MenuRounded />
              </IconButton>
            </Tooltip>
            <Brand />
          </Box>
          <Drawer
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH + 32, maxWidth: "85vw", backgroundImage: "none" } } }}
          >
            <Navigation onNavigate={() => setMenuOpen(false)} />
          </Drawer>
        </>
      )}

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          px: { xs: 4, sm: 6, md: 8 },
          pt: { xs: "88px", md: 8 },
          pb: { xs: 8, md: 12 },
        }}
      >
        <Box sx={{ maxWidth: 1120, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
