import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import TopBar from "../components/TopBar.jsx";

export default function ViewerHome() {
  const [sections, setSections] = useState(null);
  const [error, setError] = useState(null);

  const fetchSections = () => {
    setSections(null);
    setError(null);
    api.getSections()
      .then((data) => setSections(data || []))
      .catch((err) => {
        console.error("Failed to load sections:", err);
        setError(err.message || "Sections load nahi ho paaye.");
      });
  };

  useEffect(() => {
    fetchSections();
  }, []);

  return (
    <div className="page">
      <TopBar title="Resource Navigator" />
      <div className="button-grid">
        {error ? (
          <div className="hint error-box" style={{ color: "#ff6b6b", textAlign: "center", width: "100%", gridColumn: "1 / -1" }}>
            <p>⚠️ Error: {error}</p>
            <button className="btn btn-primary" onClick={fetchSections} style={{ marginTop: "10px" }}>
              Retry
            </button>
          </div>
        ) : sections === null ? (
          <p className="hint">Loading…</p>
        ) : sections.length === 0 ? (
          <p className="hint">Abhi koi section nahi hai. Admin panel se add karo.</p>
        ) : (
          sections.map((s) => (
            <Link key={s.id} to={`/s/${s.id}`} className="menu-btn">
              {s.title}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}