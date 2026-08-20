import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Boshqaruv paneli
        </NavLink>
        <NavLink to="/calls" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Qo'ng'iroqlar
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Sozlamalar
        </NavLink>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-title">AI Sales Call Analyzer</div>
          <div className="topbar-right">
            <span>Asadbek</span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
