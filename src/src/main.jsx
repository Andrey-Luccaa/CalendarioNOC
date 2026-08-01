import React from 'react';
import ReactDOM from 'react-dom/client';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import App from './App';
import './styles.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#19d3ff' },
    secondary: { main: '#8b5cf6' },
    background: { default: '#020406', paper: '#090d12' },
    text: { primary: '#f5fbff', secondary: '#8e9ba7' },
    success: { main: '#35d99a' },
    error: { main: '#ff5d73' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif',
    button: { textTransform: 'none', fontWeight: 800 },
  },
  components: {
    MuiDialog: { styleOverrides: { paper: { backgroundImage: 'none', border: '1px solid #202832', boxShadow: '0 30px 100px #000' } } },
    MuiButton: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiIconButton: { styleOverrides: { root: { color: '#9eabb7' } } },
    MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: '#080c11' } } },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
