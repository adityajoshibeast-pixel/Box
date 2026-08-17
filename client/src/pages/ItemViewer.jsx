import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import TopBar from "../components/TopBar.jsx";

export default function ItemViewer() {
  const { itemId } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getItem(itemId).then(setItem).catch((e) => setError(e.message));
  }, [itemId]);

  if (error) {
    return (
      <div className="page">
        <TopBar title="Not found" backTo="/" />
        <p className="hint">{error}</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page">
        <TopBar title="Loading…" backTo="/" />
      </div>
    );
  }

  return (
    <div className="page">
      <TopBar title={item.title} backTo="/" />
      <div className="viewer-toolbar">
        <a className="btn btn-primary" href={item.download_url} download>
          Download
        </a>
      </div>
      {item.type === "pdf" ? (
        <iframe className="pdf-frame" src={item.file_url} title={item.title} />
      ) : (
        <div className="img-frame">
          <img src={item.file_url} alt={item.title} />
        </div>
      )}
    </div>
  );
}