import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import TopBar from "../components/TopBar.jsx";

const TYPE_LABEL = { link: "Link", pdf: "PDF", img: "Image" };

export default function ViewerSubsection() {
  const { sectionId, subsectionId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [subTitle, setSubTitle] = useState("");

  useEffect(() => {
    api.getItems(subsectionId).then(setItems);
    api.getSubsections(sectionId).then((all) => {
      const found = all.find((s) => s.id === subsectionId);
      if (found) setSubTitle(found.title);
    });
  }, [sectionId, subsectionId]);

  const openItem = (item) => {
    if (item.type === "link") {
      window.open(item.url, "_blank", "noopener,noreferrer");
    } else {
      navigate(`/item/${item.id}`);
    }
  };

  return (
    <div className="page">
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
    </div>
  );
}