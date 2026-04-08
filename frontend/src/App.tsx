import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import CartridgesPage from './pages/CartridgesPage';
import CartridgeDetailPage from './pages/CartridgeDetailPage';
import AdminPage from './pages/AdminPage';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/cartridges" replace />} />
          <Route path="cartridges" element={<CartridgesPage />} />
          <Route path="cartridges/:id" element={<CartridgeDetailPage />} />
          <Route
            path="admin"
            element={
              <PrivateRoute requiredRole="admin">
                <AdminPage />
              </PrivateRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
