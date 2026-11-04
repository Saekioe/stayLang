import {
  Box, Button, IconButton, Paper, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
 
/* ---------- design tokens (sx only, no CSS files) ---------- */
 
export const colors = {
  dark: '#0B3D3D',
  primary: '#457B91',
  pageBg: '#F1F1F6',
  line: '#E6E9ED',
  head: '#ECF1F5',
  title: '#1B1B1F',
  body: '#3F3636',
  muted: '#9A9AA5',
  link: '#6B8A99',
  danger: '#D32F2F',
  navActive: '#DFEEEF',
};
 
export const tableSx = {
  '& .MuiTableCell-root': {
    borderBottom: `1px solid ${colors.line}`,
    fontSize: 14,
    px: 2.5,
    py: 0,
    color: colors.body,
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    bgcolor: colors.head,
    color: colors.muted,
    fontWeight: 500,
    height: 40,
  },
  '& .MuiTableBody-root .MuiTableRow-root': { height: 56 },
  '& .MuiTableBody-root .MuiTableRow-root:last-child .MuiTableCell-root': { borderBottom: 'none' },
};
 
/* ---------- page pieces ---------- */
 
export function PageHeader({ title, subtitle }) {
  return (
    <Box sx={{ mb: 3.5 }}>
      <Typography component="h1" sx={{ fontSize: 28, fontWeight: 500, color: colors.title, lineHeight: 1.3 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: 14, color: colors.muted, mt: 1 }}>{subtitle}</Typography>
    </Box>
  );
}
 
export function Panel({ title, subtitle, action, footer, children }) {
  return (
    <Paper
      elevation={0}
      sx={{ bgcolor: '#fff', border: `1px solid ${colors.line}`, borderRadius: '20px', overflow: 'hidden' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 2.75, py: 2.75 }}>
        <Box>
          <Typography sx={{ fontSize: 18, fontWeight: 500, color: colors.title }}>{title}</Typography>
          {subtitle && <Typography sx={{ fontSize: 12, color: colors.muted, mt: 0.5 }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      {children}
      {footer && (
        <Box sx={{ px: 2.75, py: 1.75, borderTop: `1px solid ${colors.line}` }}>
          <Typography sx={{ fontSize: 12, color: colors.muted }}>{footer}</Typography>
        </Box>
      )}
    </Paper>
  );
}
 
export function StatCard({ label, value, caption, Icon, valueColor = colors.title }) {
  return (
    <Paper
      elevation={0}
      sx={{ bgcolor: '#fff', border: `1px solid ${colors.line}`, borderRadius: '20px', p: 2.75 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 14, color: colors.muted, fontWeight: 500 }}>{label}</Typography>
        <Icon sx={{ fontSize: 20, color: colors.dark }} />
      </Box>
      <Typography sx={{ fontSize: 34, fontWeight: 700, color: valueColor, mt: 2, lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 12, color: colors.muted, mt: 1.5 }}>{caption}</Typography>
    </Paper>
  );
}
 
/* ---------- status pill ---------- */
 
const PILLS = {
  active: { bg: '#2E7D32', color: '#fff' },
  approved: { bg: '#2E7D32', color: '#fff' },
  confirmed: { bg: '#DCFCE7', color: '#15803D' },
  visible: { bg: '#457B91', color: '#fff' },
  hidden: { bg: '#E9E9EC', color: '#3F3636' },
  declined: { bg: '#E9E9EC', color: '#3F3636' },
  cancelled: { bg: '#FEE2E2', color: '#B91C1C' },
  rejected: { bg: '#D32F2F', color: '#fff' },
  disabled: { bg: '#D32F2F', color: '#fff' },
  completed: { bg: '#DBEAFE', color: '#1D4ED8' },
  pending: { bg: '#FEF3C7', color: '#B45309' },
};
 
export function StatusPill({ label, variant }) {
  const style = PILLS[variant] ?? PILLS.hidden;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        height: 24,
        px: 1.5,
        borderRadius: 99,
        bgcolor: style.bg,
        color: style.color,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'currentColor' }} />
      {label}
    </Box>
  );
}
 
/* ---------- actions ---------- */
 
export function TextAction({ children, Icon, onClick, width }) {
  return (
    <Button
      size="small"
      onClick={onClick}
      startIcon={Icon ? <Icon sx={{ fontSize: '18px !important' }} /> : null}
      sx={{
        color: colors.primary, fontWeight: 700, fontSize: 14, minWidth: 0, px: 1,
        ...(width ? { width, justifyContent: 'flex-start' } : {}),
      }}
    >
      {children}
    </Button>
  );
}
 
export function DeleteButton({ onClick, label = 'Delete' }) {
  return (
    <IconButton size="small" aria-label={label} onClick={onClick} sx={{ color: colors.danger }}>
      <DeleteOutlineIcon sx={{ fontSize: 18 }} />
    </IconButton>
  );
}