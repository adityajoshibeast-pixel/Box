import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import TopBar from "../components/TopBar.jsx";
import Watermark from "../components/Watermark.jsx";

const TYPE_LABEL = { link: "Link", pdf: "PDF", img: "Image" };

export default function ViewerSubsection() {
  const { sectionId, subsectionId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [subTitle, setSubTitle] = useState("");

  useEffect(() => {
    let active = true;
    const refreshItems = () => {
      api.getItems(subsectionId)
        .then((nextItems) => active && setItems(nextItems))
        .catch((error) => console.error("Items refresh failed:", error));
    };

    refreshItems();
    api.getSubsection(subsectionId)
      .then((subsection) => active && setSubTitle(subsection.title))
      .catch((error) => console.error("Subsection load failed:", error));

    // A due one-minute/day schedule becomes visible without a manual refresh.
    const timer = window.setInterval(refreshItems, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sectionId, subsectionId]);

  const openItem = (item) => {
    if (item.type === "link") {
      window.open(item.url, "_blank", "noopener,noreferrer");
    } else {
      navigate(`/item/${item.id}`);
    }
  };

  return (
    <div className="page viewer-shell">
      <TopBar title={subTitle || "Items"} backTo={`/s/${sectionId}`} />
      <div className="button-grid">
        {items === null ? (
          <p className="hint">Loading…</p>
        ) : items.length === 0 ? (
          <p className="hint">Yahan abhi kuch nahi hai.</p>
        ) : (
          items.map((it) => (
            <button key={it.id} className="menu-btn" onClick={() => openItem(it)}>
              {it.title}
              <span className="menu-btn-tag">{TYPE_LABEL[it.type]}</span>
            </button>
          ))
        )}
      </div>
      <Watermark />
    </div>
  );
}
