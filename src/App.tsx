import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Needs from './pages/Needs';
import Purchases from './pages/Purchases';
import Settings from './pages/Settings';
import Sites from './pages/Sites';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="needs" element={<Needs />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="settings" element={<Settings />} />
            <Route path="sites" element={<Sites />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
