import { useEffect, useState } from "react";
import {
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  Typography,
} from "@mui/material";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MenuIcon from "@mui/icons-material/Menu";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../auth/Auth";
import { colors } from "./adminUi";
import adminLogo from "../../assets/adminLogo.png";

import Overview from "./Overview";
import UserManagement from "./UserManagement";
import HostManagement from "./HostManagement";
import PropertyManagement from "./PropertyManagement";
import ReservationMonitoring from "./ReservationMonitoring";
import ReviewModeration from "./ReviewModeration";
import Report from "./Report";
import Settings from "./Settings";
import AdminNotifications from "./AdminNotifications";

const ADMIN_EMAILS = ["admin@staylang.com"];
const BASE = "/admin";
const SIDEBAR_WIDTH = 230;
const TOPBAR_HEIGHT = 70;

const menuItems = [
  {
    label: "Overview",
    crumb: "Overview",
    path: BASE,
    Icon: GridViewOutlinedIcon,
  },
  {
    label: "User Management",
    crumb: "User Management",
    path: `${BASE}/users`,
    Icon: PeopleOutlineIcon,
  },
  {
    label: "Host Management",
    crumb: "Host Management",
    path: `${BASE}/hosts`,
    Icon: HowToRegOutlinedIcon,
  },
  {
    label: "Property Management",
    crumb: "Property Management",
    path: `${BASE}/properties`,
    Icon: HomeOutlinedIcon,
  },
  {
    label: "Reservation Monitoring",
    crumb: "Reservation Monitoring",
    path: `${BASE}/reservations`,
    Icon: CalendarMonthOutlinedIcon,
  },
  {
    label: "Review Moderation",
    crumb: "Review Moderation",
    path: `${BASE}/reviews`,
    Icon: ChatBubbleOutlineIcon,
  },
  {
    label: "Reports",
    crumb: "Reports",
    path: `${BASE}/reports`,
    Icon: BarChartOutlinedIcon,
  },
  {
    label: "Settings",
    crumb: "Settings",
    path: `${BASE}/settings`,
    Icon: TuneOutlinedIcon,
  },
];

const avatarSx = {
  bgcolor: "#E3EEEF",
  color: colors.dark,
  fontSize: 11,
  fontWeight: 600,
};

function SidebarContent({ isActive, onNavigate, onLogout }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: SIDEBAR_WIDTH,
        bgcolor: "#fff",
      }}
    >
      {/* Brand */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 2.5,
          pt: 3,
          pb: 3,
        }}
      >
        <Box
          component="img"
          src={adminLogo}
          alt="StayLang"
          sx={{ width: 34, height: 34, objectFit: "contain" }}
        />
        <Box>
          <Typography
            sx={{
              fontSize: 22,
              fontWeight: 500,
              color: colors.dark,
              lineHeight: 1.1,
            }}
          >
            StayLang
          </Typography>
          <Typography
            sx={{
              fontSize: 8,
              letterSpacing: "0.06em",
              color: colors.primary,
              textTransform: "uppercase",
            }}
          >
            Admin Control Panel
          </Typography>
        </Box>
      </Box>

      <Typography
        sx={{
          fontSize: 10,
          letterSpacing: "0.08em",
          color: colors.muted,
          px: 3,
          mb: 1,
        }}
      >
        WORKSPACE
      </Typography>

      {/* Navigation */}
      <List
        disablePadding
        sx={{ px: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}
      >
        {menuItems.map(({ label, path, Icon }) => {
          const active = isActive(path);

          return (
            <ListItemButton
              key={label}
              component={RouterLink}
              to={path}
              selected={active}
              onClick={onNavigate}
              sx={{
                height: 44,
                borderRadius: "12px",
                px: 1.5,
                gap: 1.5,
                color: active ? colors.dark : "#4A5560",
                "&.Mui-selected, &.Mui-selected:hover": {
                  bgcolor: colors.navActive,
                },
              }}
            >
              <Icon sx={{ fontSize: 20, color: "inherit" }} />
              <Typography
                sx={{
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: "inherit",
                }}
              >
                {label}
              </Typography>
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flex: 1 }} />

      {/* Footer */}
      <Divider sx={{ mx: 2 }} />

      <Box sx={{ px: 2, py: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            mb: 1.5,
          }}
        >
          <Avatar sx={{ ...avatarSx, width: 32, height: 32 }}>AD</Avatar>
          <Box>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: colors.title,
                lineHeight: 1.3,
              }}
            >
              Administrator
            </Typography>
            <Typography sx={{ fontSize: 11, color: colors.muted }}>
              Platform admin
            </Typography>
          </Box>
        </Box>

        <ListItemButton
          onClick={onLogout}
          sx={{ borderRadius: "10px", px: 1, gap: 1.5, color: "#4A5560" }}
        >
          <LogoutOutlinedIcon sx={{ fontSize: 20 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 500, color: "inherit" }}>
            Logout
          </Typography>
        </ListItemButton>
      </Box>
    </Box>
  );
}

export default function AdminDashboard() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);

  // Logout confirmation state
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  // Firestore collections (used by the Overview)
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase())) return;

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => setError("Failed to stream users."),
    );

    const unsubProps = onSnapshot(
      collection(db, "properties"),
      (snap) => {
        setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => setError("Failed to stream properties."),
    );

    const unsubRes = onSnapshot(
      collection(db, "reservations"),
      (snap) => {
        setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => setError("Failed to stream reservations."),
    );

    return () => {
      unsubUsers();
      unsubProps();
      unsubRes();
    };
  }, [user]);

  const isActive = (path) =>
    path === BASE ? pathname === BASE : pathname.startsWith(path);

  const current = menuItems.find((m) => isActive(m.path)) ?? menuItems[0];

  const openLogoutDialog = () => {
    setLogoutError("");
    setLogoutDialogOpen(true);
  };

  const closeLogoutDialog = () => {
    if (logoutLoading) return;
    setLogoutDialogOpen(false);
    setLogoutError("");
  };

  const confirmLogout = async () => {
    setLogoutLoading(true);
    setLogoutError("");

    try {
      await logout();
      setLogoutDialogOpen(false);
      navigate("/login");
    } catch (err) {
      console.error("Admin logout failed:", err);
      setLogoutError("Failed to log out. Please try again.");
    } finally {
      setLogoutLoading(false);
    }
  };

  // Access control guard
  if (loading) {
    return (
      <Box sx={{ py: 12, textAlign: "center" }}>
        <CircularProgress sx={{ color: colors.dark }} />
      </Box>
    );
  }

  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: colors.pageBg,
        textAlign: "left",
      }}
    >
      {/* Desktop sidebar */}
      <Box
        component="aside"
        sx={{
          display: { xs: "none", lg: "block" },
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          borderRight: `1px solid ${colors.line}`,
          bgcolor: "#fff",
          zIndex: 10,
        }}
      >
        <SidebarContent isActive={isActive} onLogout={openLogoutDialog} />
      </Box>

      {/* Mobile sidebar */}
      <Drawer
        anchor="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ display: { lg: "none" } }}
      >
        <SidebarContent
          isActive={isActive}
          onNavigate={() => setMobileOpen(false)}
          onLogout={() => {
            setMobileOpen(false);
            openLogoutDialog();
          }}
        />
      </Drawer>

      {/* Right side */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          ml: { xs: 0, lg: `${SIDEBAR_WIDTH}px` },
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar */}
        <Box
          component="header"
          sx={{
            height: TOPBAR_HEIGHT,
            px: { xs: 2, md: 4.5 },
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bgcolor: "#fff",
            borderBottom: `1px solid ${colors.line}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { lg: "none" }, mr: 0.5 }}
            >
              <MenuIcon />
            </IconButton>

            <Typography sx={{ fontSize: 13, color: colors.muted }}>
              Admin workspace
            </Typography>

            <ChevronRightIcon sx={{ fontSize: 16, color: colors.muted }} />

            <Typography
              sx={{ fontSize: 13, color: colors.title, fontWeight: 500 }}
            >
              {current.crumb}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <AdminNotifications />
            <Avatar sx={{ ...avatarSx, width: 30, height: 30 }}>AD</Avatar>
          </Box>
        </Box>

        {/* Page content */}
        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            px: { xs: 2, md: 4.5 },
            py: { xs: 3, md: 5 },
          }}
        >
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 3, borderRadius: 2 }}
              onClose={() => setError("")}
            >
              {error}
            </Alert>
          )}

          <Routes>
            <Route
              index
              element={
                <Overview
                  users={users}
                  properties={properties}
                  reservations={reservations}
                />
              }
            />
            <Route path="users" element={<UserManagement />} />
            <Route path="hosts" element={<HostManagement />} />
            <Route path="properties" element={<PropertyManagement />} />
            <Route path="reservations" element={<ReservationMonitoring />} />
            <Route path="reviews" element={<ReviewModeration />} />
            <Route path="reports" element={<Report />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to={BASE} replace />} />
          </Routes>
        </Box>
      </Box>

      {/* Admin logout confirmation dialog */}
      <Dialog
        open={logoutDialogOpen}
        onClose={closeLogoutDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            color: "#1F2937",
            bgcolor: "#FFFFFF",
          }}
        >
          Log out of StayLang Admin?
        </DialogTitle>

        <DialogContent>
          <DialogContentText>
            Are you sure you want to log out of the administrator account?
          </DialogContentText>

          {logoutError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {logoutError}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={closeLogoutDialog}
            disabled={logoutLoading}
            color="inherit"
          >
            Cancel
          </Button>

          <Button
            onClick={confirmLogout}
            disabled={logoutLoading}
            variant="contained"
            color="error"
          >
            {logoutLoading ? "Logging out..." : "Log out"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
