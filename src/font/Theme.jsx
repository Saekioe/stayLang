import { createTheme } from '@mui/material/styles';

export const labelFont = '"Inika", serif';
export const urbanist = '"Urbanist", "Roboto", "Helvetica", "Arial", sans-serif';

const theme = createTheme({
  palette: {
    background: { default: '#F4F4F4' },
    text: { primary: '#3F3636' },
    primary: { main: '#457B91' },
  },
  typography: {
    fontFamily: '"Urbanist", "Roboto", "Helvetica", "Arial", sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
});

export default theme;