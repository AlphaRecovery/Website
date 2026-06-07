import Sidebar from './Sidebar.jsx';

export default function PortalLayout({ children }) {
  return (
    <div className="portal-layout">
      <Sidebar />
      <main className="portal-main">{children}</main>
    </div>
  );
}
