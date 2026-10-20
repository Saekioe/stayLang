import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './Theme';
import { AuthProvider } from './Auth';
import Login from './pages/Login';
import Signup from './pages/Signup';
import FindPlaces from './pages/Findplaces';
import MyProperty from './pages/Myproperty';
import NavigationBar from './components/NavigationBar';
import FrontPage from './components/FrontPage';
import About from './components/About';
import Places from './components/Places';

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
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}