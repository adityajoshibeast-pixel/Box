import { useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import ViewerHome from "./pages/ViewerHome.jsx";
import ViewerSection from "./pages/ViewerSection.jsx";
import ViewerSubsection from "./pages/ViewerSubsection.jsx";
import ItemViewer from "./pages/ItemViewer.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import Unsubscribe from "./pages/Unsubscribe.jsx";
import UpdateSignup from "./components/UpdateSignup.jsx";
import {
  normalizeUsername,
  USERNAME_STORAGE_KEY,
  UserProfileContext,
} from "./userProfile.jsx";

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isUnsubscribe = location.pathname === "/unsubscribe";
  const needsUsername = !isAdmin && !isUnsubscribe;
  const [username, setUsername] = useState(() =>
    normalizeUsername(localStorage.getItem(USERNAME_STORAGE_KEY))
  );
  const [editingUsername, setEditingUsername] = useState(false);

  const saveUsername = (nextUsername) => {
    const normalized = normalizeUsername(nextUsername);
    if (!normalized) return false;
    localStorage.setItem(USERNAME_STORAGE_KEY, normalized);
    setUsername(normalized);
    setEditingUsername(false);
    return true;
  };

  if (needsUsername && !username) {
    return <UsernameGate onSave={saveUsername} />;
  }

  return (
    <UserProfileContext.Provider
      value={{ username, requestUsernameChange: () => setEditingUsername(true) }}
    >
      <div className="app">
        <Routes>
          <Route path="/" element={<ViewerHome />} />
          <Route path="/s/:sectionId" element={<ViewerSection />} />
          <Route path="/s/:sectionId/ss/:subsectionId" element={<ViewerSubsection />} />
          <Route path="/item/:itemId" element={<ItemViewer />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        {!isAdmin && !isUnsubscribe && <UpdateSignup />}
        {needsUsername && editingUsername && (
          <UsernameGate
            initialValue={username}
            onSave={saveUsername}
            onCancel={() => setEditingUsername(false)}
            modal
          />
        )}
      </div>
    </UserProfileContext.Provider>
  );
}

function UsernameGate({ initialValue = "", onSave, onCancel, modal = false }) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (!normalizeUsername(value)) {
      setError("Please enter a username.");
      return;
    }
    onSave(value);
  };

  return (
    <div className={`username-gate ${modal ? "username-gate-modal" : ""}`}>
      <form className="username-card" onSubmit={submit}>
        <div className="username-mark" aria-hidden="true">RN</div>
        <p className="username-eyebrow">Resource Navigator</p>
        <h1>{modal ? "Change username" : "Welcome"}</h1>
        <p className="username-copy">
          {modal
            ? "Choose the name you want to use on this browser."
            : "Enter a username to continue to the resource library."}
        </p>
        <label htmlFor="visitor-username">Username</label>
        <input
          id="visitor-username"
          type="text"
          placeholder="Please enter username"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={40}
          autoComplete="nickname"
          autoFocus
        />
        {error && <span className="slip-error">{error}</span>}
        <div className="username-actions">
          {onCancel && (
            <button className="btn btn-ghost" type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="btn btn-primary" type="submit">
            {modal ? "Save username" : "Continue"}
          </button>
        </div>
        {!modal && (
          <p className="username-storage-note">
            This name stays saved in this browser until its site data is cleared.
          </p>
        )}
      </form>
    </div>
  );
}

function NotFound() {
  return (
    <div className="page">
      <p>Page not found.</p>
      <Link to="/">Go home</Link>
    </div>
  );
}
