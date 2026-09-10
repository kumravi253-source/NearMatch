import { NavLink, Outlet } from 'react-router-dom';
import { Logo } from './Logo';

// Same four tabs, same icons and labels as the mobile app's TABS array.
const TABS = [
  { to: '/discover', label: 'Discover', icon: '🔥' },
  { to: '/likes', label: 'Likes', icon: '💫' },
  { to: '/matches', label: 'Matches', icon: '💛' },
  { to: '/chat', label: 'Chat', icon: '💬' },
  { to: '/account', label: 'Account', icon: '⚙️' },
];

export function AppShell() {
  return (
    <div className="nm-shell">
      <nav className="nm-tabbar" aria-label="Main">
        <div className="nm-tabbar__brand">
          <Logo size={26} />
        </div>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className="nm-tab">
            <span className="nm-tab__icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="nm-tab__label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
