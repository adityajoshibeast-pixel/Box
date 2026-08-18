import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import TopBar from "../components/TopBar.jsx";

export default function ViewerSection() {
  const { sectionId } = useParams();
  const [subsections, setSubsections] = useState(null);
  const [sectionTitle, setSectionTitle] = useState("");
  const [error, setError] = useState(null);

  const fetchSubsections = () => {
    setSubsections(null);
    setError(null);
    api.getSubsections(sectionId)
      .then((data) => setSubsections(data || []))
      .catch((err) => {
        console.error("Failed to load subsections:", err);
        setError(err.message || "Subsections load nahi ho paaye.");
      });

    api.getSections()
      .then((all) => {
        const found = all?.find((s) => s.id === sectionId);
        if (found) setSectionTitle(found.title);
      })
      .catch((err) => console.error("Failed to load section title:", err));
  };

  useEffect(() => {
    fetchSubsections();
  }, [sectionId]);

  return (
    <div className="page">
      <TopBar title={sectionTitle || "Section"} backTo="/" />
      <div className="button-grid">
        {error ? (
          <div className="hint error-box" style={{ color: "#ff6b6b", textAlign: "center", width: "100%", gridColumn: "1 / -1" }}>
            <p>⚠️ Error: {error}</p>
            <button className="btn btn-primary" onClick={fetchSubsections} style={{ marginTop: "10px" }}>
              Retry
            </button>
          </div>
        ) : subsections === null ? (
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
    </div>
  );
}