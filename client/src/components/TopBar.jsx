import { Link } from "react-router-dom";

export default function TopBar({ title, backTo }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        {backTo && (
          <Link to={backTo} className="back-link">
            &larr; Back
          </Link>
        )}
        <h1 className="topbar-title">{title}</h1>
      </div>
      <Link to="/admin" className="admin-link">
        Admin
      </Link>
    </header>
  );
}