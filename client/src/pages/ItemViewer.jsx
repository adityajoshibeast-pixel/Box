import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import TopBar from "../components/TopBar.jsx";
import Watermark from "../components/Watermark.jsx";
import { useUserProfile } from "../userProfile.jsx";

export default function ItemViewer() {
  const { itemId } = useParams();
  const { username } = useUserProfile();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getItem(itemId).then(setItem).catch((e) => setError(e.message));
  }, [itemId]);

  if (error) {
    return (
      <div className="page viewer-shell">
        <TopBar title="Not found" backTo="/" />
        <p className="hint">{error}</p>
        <Watermark />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page viewer-shell">
        <TopBar title="Loading…" backTo="/" />
        <Watermark />
      </div>
    );
  }

  return (
    <div className="page viewer-shell">
      <TopBar title={item.title} backTo="/" />
      <div className="viewer-toolbar">
        <form
          className="download-form"
          method="post"
          action={`/api/items/${encodeURIComponent(item.id)}/download`}
        >
          <input type="hidden" name="username" value={username} />
          <button className="btn btn-primary" type="submit">
            Download
          </button>
        </form>
      </div>
      {item.type === "pdf" ? (
        <iframe className="pdf-frame" src={item.file_url} title={item.title} />
      ) : (
        <div className="img-frame">
          <img src={item.file_url} alt={item.title} />
        </div>
      )}
      <Watermark />
    </div>
  );
}
