import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import wordmark from '../../assets/tedlinx-wordmark.png';

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const icons = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  calendar: 'M8 2v4 M16 2v4 M3 10h18 M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  receipt: 'M4 2l2 2 2-2 2 2 2-2 2 2 2-2v16l-2-2-2 2-2-2-2 2-2-2-2 2-2-2-2 2z M9 10h6 M9 14h4',
  check: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  payslip: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  box: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  laptop: 'M2 20h20 M4 4h16a1 1 0 0 1 1 1v11H3V5a1 1 0 0 1 1-1z',
  store: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0',
  megaphone: 'M3 11l18-5v12L3 14v-3z M11.6 16.8a3 3 0 0 1-5.8-1.6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  menu: 'M3 12h18 M3 6h18 M3 18h18',
  close: 'M18 6L6 18 M6 6l12 12',
};

export default function Sidebar() {
  const { user, logout, isManager } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const isStorekeeper = user?.role === 'storekeeper';
  const [open, setOpen] = useState(false);

  // Close sidebar when route changes on mobile
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest('aside') && !e.target.closest('.burger-btn')) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navLink = (to, icon, label, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
      <Icon d={icons[icon]} /> {label}
    </NavLink>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button className="burger-btn" onClick={() => setOpen(o => !o)} aria-label="Toggle menu">
          <Icon d={open ? icons.close : icons.menu} />
        </button>
        <img src={wordmark} alt="TEDLinx" style={{ height: 28, objectFit: 'contain' }} />
        <div style={{ width: 40 }} />
      </div>

      {/* Overlay */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src={wordmark} alt="TEDLinx" style={{ width: '100%', maxWidth: 160, height: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-role">{user?.role}</div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Main</div>
            {navLink('/', 'home', 'Home', true)}
          </div>

          {!isAdmin && (
            <div className="nav-section">
              <div className="nav-section-label">My requests</div>
              {navLink('/leave', 'calendar', 'Leave')}
              {navLink('/expenses', 'receipt', 'Expenses')}
            </div>
          )}

          <div className="nav-section">
            <div className="nav-section-label">Resources</div>
            {navLink('/directory', 'users', 'Directory')}
            {navLink('/documents', 'folder', 'Documents')}
            {navLink('/payslips', 'payslip', 'Payslips')}
            {navLink('/inventory', 'box', 'Inventory')}
            {!isAdmin && navLink('/my-assets', 'laptop', 'My assets')}
          </div>

          {(isManager || isAdmin) && (
            <div className="nav-section">
              <div className="nav-section-label">Manager</div>
              {navLink('/manager/approvals', 'check', 'Approvals')}
            </div>
          )}

          {(isStorekeeper || isAdmin) && (
            <div className="nav-section">
              <div className="nav-section-label">Storekeeper</div>
              {navLink('/storekeeper', 'store', 'Manage inventory')}
              {navLink('/storekeeper/assets', 'laptop', 'Manage assets')}
            </div>
          )}

          {isAdmin && (
            <div className="nav-section">
              <div className="nav-section-label">Admin</div>
              {navLink('/admin/users', 'shield', 'User management')}
              {navLink('/admin/broadcasts', 'megaphone', 'Broadcasts')}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <Icon d={icons.logout} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
