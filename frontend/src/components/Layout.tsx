import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="brand-icon">🖨️</span>
          <span className="brand-name">CartridgeMS</span>
        </div>
        <div className="navbar-links">
          <Link
            to="/cartridges"
            className={location.pathname.startsWith('/cartridges') ? 'active' : ''}
          >
            Cartridges
          </Link>
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className={location.pathname === '/admin' ? 'active' : ''}
            >
              Admin Panel
            </Link>
          )}
        </div>
        <div className="navbar-user">
          <span className="user-badge role-{user?.role}">
            <span className="user-name">{user?.username}</span>
            <span className={`role-tag role-${user?.role}`}>{user?.role}</span>
          </span>
          <button className="btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
