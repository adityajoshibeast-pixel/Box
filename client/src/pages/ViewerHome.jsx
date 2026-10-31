import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import TopBar from "../components/TopBar.jsx";
import Watermark from "../components/Watermark.jsx";

export default function ViewerHome() {
  const [sections, setSections] = useState(null);

  useEffect(() => {
    api.getSections().then(setSections);
  }, []);

  return (
    <div className="page viewer-shell">
      <TopBar title="Resource Navigator" />
      <section className="hero-copy" aria-labelledby="welcome-title">
        <p className="hero-kicker">A curious little corner of the night</p>
        <h2 id="welcome-title">Welcome to the <span>Resource Castle</span></h2>
        <p>Follow the lanterns, choose a chapter, and discover something useful beneath the moon.</p>
      </section>
      <div className="button-grid">
        {sections === null ? (
          <p className="hint">Loading…</p>
        ) : sections.length === 0 ? (
          <p className="hint">Abhi koi section nahi hai. Admin panel se add karo.</p>
        ) : (
          sections.map((s) => (
            <Link key={s.id} to={`/s/${s.id}`} className="menu-btn">
              {s.title}
              <span className="menu-btn-tag">🎃 Explore</span>
            </Link>
          ))
        )}
      </div>
      <Watermark />
    </div>
  );
}
