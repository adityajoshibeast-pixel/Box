import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import TopBar from "../components/TopBar.jsx";

export default function ViewerHome() {
  const [sections, setSections] = useState(null);

  useEffect(() => {
    api.getSections().then(setSections);
  }, []);

  return (
    <div className="page">
      <TopBar title="Resource Navigator" />
      <div className="button-grid">
        {sections === null ? (
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