import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import TopBar from "../components/TopBar.jsx";
import Watermark from "../components/Watermark.jsx";

export default function ViewerSection() {
  const { sectionId } = useParams();
  const [subsections, setSubsections] = useState(null);
  const [sectionTitle, setSectionTitle] = useState("");

  useEffect(() => {
    api.getSubsections(sectionId).then(setSubsections);
    api.getSections().then((all) => {
      const found = all.find((s) => s.id === sectionId);
      if (found) setSectionTitle(found.title);
    });
  }, [sectionId]);

  return (
    <div className="page viewer-shell">
      <TopBar title={sectionTitle || "Section"} backTo="/" />
      <div className="button-grid">
        {subsections === null ? (
          <p className="hint">Loading…</p>
        ) : subsections.length === 0 ? (
          <p className="hint">Is section me abhi kuch nahi hai.</p>
        ) : (
          subsections.map((ss) => (
            <Link key={ss.id} to={`/s/${sectionId}/ss/${ss.id}`} className="menu-btn">
              {ss.title}
            </Link>
          ))
        )}
      </div>
      <Watermark />
    </div>
  );
}