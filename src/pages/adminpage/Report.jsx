import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Divider,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from "@mui/material";

import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";

import { money, statusOf, paymentStatusOf } from "../../dataqueries/Booking";
import { PageHeader, StatCard, colors } from "./adminUi";

const RED = "#D32F2F";

function getCreatedDate(value) {
  if (!value) return null;

  const date =
    typeof value.toDate === "function" ? value.toDate() : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekStart(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));

  return result;
}

function getPeriodKey(date, mode) {
  if (mode === "daily") return dateKey(date);

  if (mode === "weekly") return dateKey(getWeekStart(date));

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Generate chart periods based on the selected report date range.
function createBuckets(mode, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end < start) return [];

  const buckets = [];

  if (mode === "daily") {
    const current = new Date(start);

    while (current <= end) {
      buckets.push({
        key: dateKey(current),
        label: current.toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        }),
        value: 0,
      });

      current.setDate(current.getDate() + 1);
    }

    return buckets;
  }

  if (mode === "weekly") {
    const current = getWeekStart(start);
    const lastWeek = getWeekStart(end);

    while (current <= lastWeek) {
      buckets.push({
        key: dateKey(current),
        label: current.toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        }),
        value: 0,
      });

      current.setDate(current.getDate() + 7);
    }

    return buckets;
  }

  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= lastMonth) {
    buckets.push({
      key: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`,
      label: current.toLocaleDateString("en-PH", {
        month: "short",
        year: "2-digit",
      }),
      value: 0,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return buckets;
}

function createBookingTrendData(reservations, mode, start, end) {
  const buckets = createBuckets(mode, start, end);

  reservations.forEach((reservation) => {
    const created = getCreatedDate(reservation.createdAt);
    if (!created) return;

    const bucket = buckets.find(
      (item) => item.key === getPeriodKey(created, mode),
    );

    if (bucket) bucket.value += 1;
  });

  return buckets;
}

function createRevenueTrendData(reservations, mode, start, end) {
  const buckets = createBuckets(mode, start, end);

  reservations.forEach((reservation) => {
    if (paymentStatusOf(reservation) !== "paid") return;

    const created = getCreatedDate(reservation.createdAt);
    if (!created) return;

    const bucket = buckets.find(
      (item) => item.key === getPeriodKey(created, mode),
    );

    if (bucket) {
      bucket.value += Number(reservation.serviceFee) || 0;
    }
  });

  return buckets;
}

function getDateRange(filter, customStart, customEnd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  if (filter === "all") {
    return { start: null, end: null };
  }

  if (filter === "today") {
    return { start: today, end: endOfToday };
  }

  if (filter === "week") {
    return { start: getWeekStart(today), end: endOfToday };
  }

  if (filter === "month") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: endOfToday,
    };
  }

  if (filter === "year") {
    return {
      start: new Date(today.getFullYear(), 0, 1),
      end: endOfToday,
    };
  }

  if (filter === "custom") {
    const start = customStart ? new Date(`${customStart}T00:00:00`) : null;

    const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;

    return {
      start: start && !Number.isNaN(start.getTime()) ? start : null,
      end: end && !Number.isNaN(end.getTime()) ? end : null,
    };
  }

  return { start: null, end: null };
}

// Determine chart boundaries, including All Time and partially entered custom dates.
function getChartRange(reservations, range) {
  const dates = reservations
    .map((r) => getCreatedDate(r.createdAt))
    .filter(Boolean)
    .sort((a, b) => a - b);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const start = range.start
    ? new Date(range.start)
    : dates.length
      ? new Date(dates[0])
      : new Date(today);

  const end = range.end ? new Date(range.end) : today;

  start.setHours(0, 0, 0, 0);

  return { start, end };
}

function Legend({ color, label }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: "2px",
          bgcolor: color,
        }}
      />
      <Typography sx={{ fontSize: 12, color: colors.muted }}>
        {label}
      </Typography>
    </Box>
  );
}

function BarRow({ label, value, max, color }) {
  const width = max > 0 ? (value / max) * 85 : 0;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
      <Typography
        sx={{
          width: { xs: 110, md: 165 },
          fontSize: 13,
          color: colors.body,
          flexShrink: 0,
        }}
      >
        {label}
      </Typography>

      <Box
        sx={{
          flex: 1,
          height: 28,
          borderRadius: "6px",
          bgcolor: "#F8F9FB",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: `${width}%`,
            height: "100%",
            bgcolor: color,
            borderRadius: "6px",
            transition: "width 0.4s ease",
          }}
        />
      </Box>

      <Typography sx={{ width: 24, fontSize: 14, color: colors.body }}>
        {value}
      </Typography>
    </Box>
  );
}

function TrendChart({ title, subtitle, data, isCurrency = false }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: "#fff",
        border: `1px solid ${colors.line}`,
        borderRadius: "20px",
        p: 2.5,
        minWidth: 0,
      }}
    >
      <Typography sx={{ fontSize: 17, fontWeight: 500, color: colors.title }}>
        {title}
      </Typography>

      <Typography sx={{ fontSize: 12, color: colors.muted, mt: 0.5 }}>
        {subtitle}
      </Typography>

      {data.length === 0 ? (
        <Typography
          sx={{ py: 5, textAlign: "center", color: colors.muted, fontSize: 13 }}
        >
          No chart data available for this period.
        </Typography>
      ) : (
        <Box sx={{ overflowX: "auto", mt: 3 }}>
          <Box
            sx={{
              minWidth: `${Math.max(data.length * 48, 300)}px`,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 1,
              height: 155,
              borderBottom: `1px solid ${colors.line}`,
            }}
          >
            {data.map((item) => {
              const height =
                item.value > 0 ? Math.max((item.value / maxValue) * 110, 5) : 3;

              return (
                <Box
                  key={item.key}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 0.75,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: colors.body,
                      fontWeight: 500,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isCurrency
                      ? item.value > 0
                        ? money(item.value)
                        : "₱0"
                      : item.value}
                  </Typography>

                  <Box
                    sx={{
                      width: "65%",
                      maxWidth: 34,
                      height: `${height}px`,
                      bgcolor: colors.dark,
                      borderRadius: "5px 5px 0 0",
                      transition: "height 0.4s ease",
                    }}
                  />

                  <Typography
                    sx={{
                      fontSize: 10,
                      color: colors.muted,
                      whiteSpace: "nowrap",
                      mt: 0.75,
                    }}
                  >
                    {item.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

function getTopProperties(reservations) {
  const propertyMap = new Map();

  reservations.forEach((reservation) => {
    if (!reservation.propertyId) return;

    const propertyId = reservation.propertyId;

    if (!propertyMap.has(propertyId)) {
      propertyMap.set(propertyId, {
        id: propertyId,
        name: reservation.propertyTitle || "Untitled Property",
        bookings: 0,
        revenue: 0,
      });
    }

    const property = propertyMap.get(propertyId);

    if (reservation.status === "confirmed") {
      property.bookings += 1;
    }

    if (paymentStatusOf(reservation) === "paid") {
      property.revenue += Number(reservation.serviceFee) || 0;
    }
  });

  return Array.from(propertyMap.values())
    .filter((property) => property.bookings > 0)
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5);
}

function TopProperties({ properties }) {
  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: "#fff",
        border: `1px solid ${colors.line}`,
        borderRadius: "20px",
        p: 2.5,
        mb: 3,
      }}
    >
      <Typography sx={{ fontSize: 18, fontWeight: 500, color: colors.title }}>
        Top-Performing Properties
      </Typography>

      <Typography sx={{ fontSize: 12, color: colors.muted, mt: 0.5, mb: 2.5 }}>
        Properties ranked by their number of confirmed reservations.
      </Typography>

      {properties.length === 0 ? (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <InfoOutlinedIcon sx={{ fontSize: 32, color: colors.muted, mb: 1 }} />

          <Typography
            sx={{ fontSize: 14, color: colors.body, fontWeight: 500 }}
          >
            No property booking data available yet.
          </Typography>

          <Typography sx={{ fontSize: 12, color: colors.muted, mt: 0.5 }}>
            Confirmed property reservations will appear here.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 420 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "40px minmax(130px, 1fr) 100px 120px",
                gap: 1.5,
                px: 1,
                pb: 1.5,
                borderBottom: `1px solid ${colors.line}`,
              }}
            >
              {["#", "Property", "Bookings", "Platform Revenue"].map(
                (heading) => (
                  <Typography
                    key={heading}
                    sx={{ fontSize: 11, color: colors.muted, fontWeight: 600 }}
                  >
                    {heading}
                  </Typography>
                ),
              )}
            </Box>

            {properties.map((property, index) => (
              <Box
                key={property.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "40px minmax(130px, 1fr) 100px 120px",
                  gap: 1.5,
                  alignItems: "center",
                  px: 1,
                  py: 2,
                  borderBottom:
                    index === properties.length - 1
                      ? "none"
                      : `1px solid ${colors.line}`,
                }}
              >
                <Typography
                  sx={{ fontSize: 13, fontWeight: 600, color: colors.muted }}
                >
                  {index + 1}
                </Typography>

                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: colors.title,
                    overflowWrap: "anywhere",
                  }}
                >
                  {property.name}
                </Typography>

                <Typography sx={{ fontSize: 13, color: colors.body }}>
                  {property.bookings}
                </Typography>

                <Typography
                  sx={{ fontSize: 13, fontWeight: 500, color: colors.body }}
                >
                  {money(property.revenue)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

export default function Report() {
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState("");

  const [dateFilter, setDateFilter] = useState("month");

  const today = new Date();
  const todayString = dateKey(today);

  const [customStart, setCustomStart] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
  );

  const [customEnd, setCustomEnd] = useState(todayString);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "reservations"),
      (snap) => {
        setReservations(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })),
        );
      },
      () => setError("Failed to stream reservations."),
    );

    return unsub;
  }, []);

  const dateRange = getDateRange(dateFilter, customStart, customEnd);

  const invalidCustomRange =
    dateFilter === "custom" &&
    customStart &&
    customEnd &&
    customStart > customEnd;

  const filteredReservations = reservations.filter((reservation) => {
    const created = getCreatedDate(reservation.createdAt);

    if (!created || invalidCustomRange) return false;
    if (dateRange.start && created < dateRange.start) return false;
    if (dateRange.end && created > dateRange.end) return false;

    return true;
  });

  const chartRange = getChartRange(filteredReservations, dateRange);

  const confirmed = filteredReservations.filter(
    (r) => r.status === "confirmed",
  );

  const completed = filteredReservations.filter(
    (r) => statusOf(r) === "completed",
  );

  const pendingCount = filteredReservations.filter(
    (r) => r.status === "pending",
  ).length;

  const cancelledCount = filteredReservations.filter(
    (r) => r.status === "declined" || r.status === "cancelled",
  ).length;

  const paidReservations = filteredReservations.filter(
    (r) => paymentStatusOf(r) === "paid",
  );

  const totalEarnings = paidReservations.reduce(
    (sum, r) => sum + (Number(r.serviceFee) || 0),
    0,
  );

  const max = Math.max(confirmed.length, cancelledCount, 1);

  // All chart groups now use the selected date range.
  const dailyTrends = createBookingTrendData(
    filteredReservations,
    "daily",
    chartRange.start,
    chartRange.end,
  );

  const weeklyTrends = createBookingTrendData(
    filteredReservations,
    "weekly",
    chartRange.start,
    chartRange.end,
  );

  const monthlyTrends = createBookingTrendData(
    filteredReservations,
    "monthly",
    chartRange.start,
    chartRange.end,
  );

  const dailyRevenue = createRevenueTrendData(
    filteredReservations,
    "daily",
    chartRange.start,
    chartRange.end,
  );

  const weeklyRevenue = createRevenueTrendData(
    filteredReservations,
    "weekly",
    chartRange.start,
    chartRange.end,
  );

  const monthlyRevenue = createRevenueTrendData(
    filteredReservations,
    "monthly",
    chartRange.start,
    chartRange.end,
  );

  const topProperties = getTopProperties(filteredReservations);

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <PageHeader
        title="Reports & Analytics"
        subtitle="Monitor booking performance, reservation outcomes, and platform revenue."
      />

      {/* DATE RANGE FILTER */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: "#fff",
          border: `1px solid ${colors.line}`,
          borderRadius: "20px",
          p: 2.5,
          mb: 3,
        }}
      >
        <Typography
          sx={{ fontSize: 16, fontWeight: 500, color: colors.title, mb: 2 }}
        >
          Filter Reports by Date
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: { xs: "stretch", sm: "center" },
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel id="report-date-filter-label">Date Range</InputLabel>

            <Select
              labelId="report-date-filter-label"
              value={dateFilter}
              label="Date Range"
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">This Week</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
              <MenuItem value="custom">Custom Date Range</MenuItem>
            </Select>
          </FormControl>

          {dateFilter === "custom" && (
            <>
              <TextField
                label="Start Date"
                type="date"
                size="small"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 165 }}
              />

              <TextField
                label="End Date"
                type="date"
                size="small"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: customStart }}
                sx={{ minWidth: 165 }}
              />
            </>
          )}
        </Box>

        <Typography sx={{ fontSize: 12, color: colors.muted, mt: 1.5 }}>
          {dateFilter === "all"
            ? "Showing all reservations with valid creation dates."
            : dateFilter === "custom"
              ? "Showing reservations created within your selected date range."
              : `Showing reservations created ${dateFilter === "today" ? "today" : dateFilter === "week" ? "this week" : dateFilter === "month" ? "this month" : "this year"}.`}
        </Typography>

        {invalidCustomRange && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            The start date cannot be later than the end date.
          </Alert>
        )}
      </Paper>

      {/* STATISTICS CARDS */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(3, 1fr)",
          },
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          label="Platform Revenue"
          value={money(totalEarnings)}
          caption="Collected platform service fees"
          Icon={AccountBalanceWalletOutlinedIcon}
        />

        <StatCard
          label="Confirmed Stays"
          value={confirmed.length}
          caption="Confirmed reservations"
          Icon={EventAvailableOutlinedIcon}
        />

        <StatCard
          label="Completed Stays"
          value={completed.length}
          caption="Guests whose stay has ended"
          Icon={EventAvailableOutlinedIcon}
        />

        <StatCard
          label="Pending Bookings"
          value={pendingCount}
          caption="Awaiting reservation decision"
          Icon={InfoOutlinedIcon}
        />

        <StatCard
          label="Cancelled/Declined"
          value={cancelledCount}
          caption="Cancelled or declined reservations"
          Icon={EventBusyOutlinedIcon}
        />
      </Box>

      {/* BOOKING VOLUME SUMMARY */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: "#fff",
          border: `1px solid ${colors.line}`,
          borderRadius: "20px",
          p: 2.75,
          mb: 3,
        }}
      >
        <Typography sx={{ fontSize: 18, fontWeight: 500, color: colors.title }}>
          Booking Volume Summary
        </Typography>

        <Typography
          sx={{ fontSize: 12, color: colors.muted, mt: 0.5, mb: 2.5 }}
        >
          A comparison of confirmed and cancelled reservation outcomes.
        </Typography>

        <Box sx={{ display: "flex", gap: 3, mb: 3, flexWrap: "wrap" }}>
          <Legend color={colors.dark} label="Confirmed Stays" />
          <Legend color={RED} label="Cancelled/Declined" />
        </Box>

        <BarRow
          label="Confirmed Stays"
          value={confirmed.length}
          max={max}
          color={colors.dark}
        />

        <BarRow
          label="Cancelled/Declined"
          value={cancelledCount}
          max={max}
          color={RED}
        />

        <Divider sx={{ my: 2.5 }} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <InfoOutlinedIcon sx={{ fontSize: 16, color: colors.muted }} />

          <Typography sx={{ fontSize: 13, color: colors.link }}>
            Total collected platform service fees: {money(totalEarnings)}.
          </Typography>
        </Box>
      </Paper>

      {/* BOOKING TRENDS */}
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 500, color: colors.title }}>
          Booking Trends
        </Typography>

        <Typography sx={{ fontSize: 13, color: colors.muted, mt: 0.5 }}>
          Daily, weekly, and monthly booking activity within the selected date
          range.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, 1fr)",
            xl: "repeat(3, 1fr)",
          },
          gap: 2,
          mb: 3,
        }}
      >
        <TrendChart
          title="Daily Bookings"
          subtitle="Bookings grouped by day"
          data={dailyTrends}
        />

        <TrendChart
          title="Weekly Bookings"
          subtitle="Bookings grouped by week"
          data={weeklyTrends}
        />

        <TrendChart
          title="Monthly Bookings"
          subtitle="Bookings grouped by month"
          data={monthlyTrends}
        />
      </Box>

      {/* REVENUE TRENDS */}
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 500, color: colors.title }}>
          Revenue Trends
        </Typography>

        <Typography sx={{ fontSize: 13, color: colors.muted, mt: 0.5 }}>
          Collected platform service fees grouped by day, week, and month.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, 1fr)",
            xl: "repeat(3, 1fr)",
          },
          gap: 2,
          mb: 3,
        }}
      >
        <TrendChart
          title="Daily Revenue"
          subtitle="Collected service fees grouped by day"
          data={dailyRevenue}
          isCurrency
        />

        <TrendChart
          title="Weekly Revenue"
          subtitle="Collected service fees grouped by week"
          data={weeklyRevenue}
          isCurrency
        />

        <TrendChart
          title="Monthly Revenue"
          subtitle="Collected service fees grouped by month"
          data={monthlyRevenue}
          isCurrency
        />
      </Box>

      {/* TOP-PERFORMING PROPERTIES */}
      <TopProperties properties={topProperties} />
    </>
  );
}
