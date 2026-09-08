import { Link } from "react-router-dom";
import { useUserProfile } from "../userProfile.jsx";

export default function TopBar({ title, backTo }) {
  const { username, requestUsernameChange } = useUserProfile();

  return (
    <header className="topbar">
      <div className="topbar-left">
        {username && (
          <button
            className="username-chip"
            type="button"
            onClick={requestUsernameChange}
            title="Change username"
          >
            <span className="username-avatar" aria-hidden="true">
              {username.charAt(0).toUpperCase()}
            </span>
            <span className="username-chip-text">{username}</span>
            <span className="username-change-label">Change</span>
          </button>
        )}
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
