import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './font/Theme';
import { AuthProvider } from './auth/Auth';
import Login from './pages/Login';
import Signup from './pages/Signup';
import FindPlaces from './pages/Findplaces';
import MyProperty from './pages/Myproperty';
import MyBookings from './pages/MyBookings.jsx';
import NavigationBar from './components/NavigationBar';
import FrontPage from './components/FrontPage';
import About from './components/About';
import Places from './components/Places';
import AdminDashboard from './pages/adminpage/AdminDashboard';

function Home() {
  return (
    <>
      <NavigationBar />
      <FrontPage />
      <About />
      <Places />
    </>
  );
}

// Makes links like "/#about" scroll to the section, and resets scroll on page changes.
function ScrollToHash() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo(0, 0);
  }, [hash, pathname]);
  return null;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <ScrollToHash />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/places" element={<FindPlaces />} />
            <Route path="/my-property" element={<MyProperty />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            {/* Any address that is not listed above goes back to the home page */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}