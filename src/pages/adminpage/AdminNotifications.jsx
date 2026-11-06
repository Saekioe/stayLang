import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";

import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";

import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { colors } from "./adminUi";

const getTime = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return null;
};

const formatTime = (timestamp) => {
  const date = getTime(timestamp);
  if (!date) return "Recently";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function AdminNotifications() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [properties, setProperties] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [ready, setReady] = useState([]);
  const [error, setError] = useState("");

  const [readIds, setReadIds] = useState(() => {
    return JSON.parse(localStorage.getItem("admin-read-notifications") || "[]");
  });

  const open = Boolean(anchorEl);

  useEffect(() => {
    const markReady = (key) => {
      setReady((previous) =>
        previous.includes(key) ? previous : [...previous, key],
      );
    };

    const subscribe = (name, setter) =>
      onSnapshot(
        collection(db, name),
        (snapshot) => {
          setter(
            snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })),
          );
          if (name === "hostApplications") {
            console.log(
              "HOST APPLICATIONS:",
              snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              })),
            );
          }
          markReady(name);
        },
        () => {
          setError("Some admin notifications could not be loaded.");
          markReady(name);
        },
      );

    const unsubscribers = [
      subscribe("users", setUsers),
      subscribe("hostApplications", setApplications),
      subscribe("properties", setProperties),
      subscribe("reservations", setReservations),
      subscribe("reviews", setReviews),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const items = useMemo(() => {
    const activity = [
      ...users.map((u) => ({
        id: `user-${u.id}`,
        title: "New customer registered",
        detail:
          `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() ||
          u.email ||
          "New user",
        timestamp: u.createdAt,
        path: "/admin/users",
        Icon: PersonAddOutlinedIcon,
        color: "#3976A8",
      })),

      ...applications.map((a) => ({
        id: `host-${a.id}`,
        title: "New host application",
        detail: a.fullName || a.email || "A host wants to join",
        timestamp: a.submittedAt,
        path: "/admin/hosts",
        Icon: PendingActionsOutlinedIcon,
        color: "#B7791F",
      })),

      ...properties.map((p) => ({
        id: `property-${p.id}`,
        title: "New property listing",
        detail: [p.title, p.city].filter(Boolean).join(" · "),
        timestamp: p.createdAt,
        path: "/admin/properties",
        Icon: HomeWorkOutlinedIcon,
        color: "#397A60",
      })),

      ...reservations
        .filter((r) => r.status === "pending")
        .map((r) => ({
          id: `reservation-${r.id}`,
          title: "New reservation request",
          detail: `${r.guestName || "A guest"} · ${r.propertyTitle || "Property"}`,
          timestamp: r.createdAt,
          path: "/admin/reservations",
          Icon: EventAvailableOutlinedIcon,
          color: "#7B61A8",
        })),

      ...reviews.map((r) => ({
        id: `review-${r.id}`,
        title: "New customer review",
        detail: `${r.guestName || "A guest"} · ${r.propertyTitle || "Property"}`,
        timestamp: r.createdAt,
        path: "/admin/reviews",
        Icon: RateReviewOutlinedIcon,
        color: "#B7791F",
      })),
    ];

    return activity
      .sort(
        (a, b) =>
          (getTime(b.timestamp)?.getTime() ?? 0) -
          (getTime(a.timestamp)?.getTime() ?? 0),
      )
      .slice(0, 10);
  }, [users, applications, properties, reservations, reviews]);

  const unreadCount = items.filter((item) => !readIds.includes(item.id)).length;

  const handleNotificationClick = (itemId) => {
    if (readIds.includes(itemId)) return;

    const updatedReadIds = [...readIds, itemId];

    setReadIds(updatedReadIds);
    localStorage.setItem(
      "admin-read-notifications",
      JSON.stringify(updatedReadIds),
    );

    setAnchorEl(null);
  };

  const loading = ready.length < 5;

  return (
    <>
      <IconButton
        aria-label="Admin notifications"
        aria-controls={open ? "admin-notifications-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          {" "}
          <NotificationsNoneOutlinedIcon
            sx={{ fontSize: 22, color: "#6B7280" }}
          />
        </Badge>
      </IconButton>

      <Menu
        id="admin-notifications-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: { xs: 320, sm: 390 },
              maxWidth: "calc(100vw - 24px)",
              maxHeight: 480,
              mt: 1.5,
              borderRadius: "14px",
              overflowY: "auto",
            },
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.75,
            position: "sticky",
            top: 0,
            zIndex: 2,
            backgroundColor: "#FFFFFF",
          }}
        >
          <Typography
            sx={{ fontSize: 16, fontWeight: 700, color: colors.title }}
          >
            Admin Notifications
          </Typography>

          <Typography sx={{ fontSize: 12, color: colors.muted }}>
            Recent activity across Pahinga
          </Typography>
        </Box>

        <Divider />

        {error && (
          <Alert severity="warning" sx={{ mx: 1.5, my: 1 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ py: 5, px: 2, textAlign: "center" }}>
            <NotificationsNoneOutlinedIcon
              sx={{ fontSize: 32, color: colors.muted, mb: 1 }}
            />
            <Typography sx={{ fontWeight: 600 }}>No activity yet</Typography>
            <Typography sx={{ fontSize: 12, color: colors.muted }}>
              New registrations, listings and reservations will appear here.
            </Typography>
          </Box>
        ) : (
          items.map((item) => {
            const Icon = item.Icon;

            return (
              <MenuItem
                key={item.id}
                component={RouterLink}
                to={item.path}
                onClick={() => handleNotificationClick(item.id)}
                sx={{
                  py: 1.5,
                  px: 2,
                  alignItems: "flex-start",
                  whiteSpace: "normal",
                  gap: 1.5,

                  backgroundColor: readIds.includes(item.id)
                    ? "#FFFFFF"
                    : "#F1F3F5",

                  "&:hover": {
                    backgroundColor: readIds.includes(item.id)
                      ? "#F8F9FA"
                      : "#E5E7EB",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    borderRadius: "10px",
                    bgcolor: `${item.color}15`,
                    color: item.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon sx={{ fontSize: 19 }} />
                </Box>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    {item.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: colors.muted,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.detail}
                  </Typography>
                  <Typography
                    sx={{ fontSize: 10, color: colors.muted, mt: 0.5 }}
                  >
                    {formatTime(item.timestamp)}
                  </Typography>
                </Box>
              </MenuItem>
            );
          })
        )}

        <Divider />
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontSize: 11, color: colors.muted }}>
            Showing the latest 10 platform activities
          </Typography>
        </Box>
      </Menu>
    </>
  );
}
