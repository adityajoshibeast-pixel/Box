import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import TopBar from "../components/TopBar.jsx";
import Watermark from "../components/Watermark.jsx";

const NAME_KEY = "viewer_name";

export default function ItemViewer() {
  const { itemId } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getItem(itemId).then(setItem).catch((e) => setError(e.message));
  }, [itemId]);

  const buildUrls = (it) => ({
    viewUrl: it.provider === "b2" ? `/api/items/${it.id}/open` : it.file_url,
    downloadUrl: it.provider === "b2" ? `/api/items/${it.id}/open?download=1` : it.download_url,
  });

  const doDownload = async (savedName) => {
    try {
      await api.logDownload(itemId, savedName);
    } catch {
      /* logging failure shouldn't block the actual download */
    }
    window.location.href = buildUrls(item).downloadUrl;
  };

  const handleDownloadClick = () => {
    const savedName = localStorage.getItem(NAME_KEY);
    if (savedName) doDownload(savedName);
    else setShowPrompt(true);
  };

  const confirmDownload = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    localStorage.setItem(NAME_KEY, name.trim());
    await doDownload(name.trim());
    setShowPrompt(false);
    setBusy(false);
  };

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

  const { viewUrl } = buildUrls(item);

  return (
    <div className="page viewer-shell">
      <TopBar title={item.title} backTo="/" />
      <div className="viewer-toolbar">
        <button className="btn btn-primary" onClick={handleDownloadClick}>
          Download
        </button>
      </div>
      {item.type === "pdf" ? (
        <iframe className="pdf-frame" src={viewUrl} title={item.title} />
      ) : (
        <div className="img-frame">
          <img src={viewUrl} alt={item.title} />
        </div>
      )}
      <Watermark />

      {showPrompt && (
        <div className="name-overlay" onClick={() => setShowPrompt(false)}>
          <form className="name-card" onClick={(e) => e.stopPropagation()} onSubmit={confirmDownload}>
            <h3>Apna naam daalo</h3>
            <p className="hint">Sirf ek baar poochenge — agli baar yaad rakh lenge.</p>
            <input
              type="text"
              placeholder="Tumhara naam"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <div className="name-card-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowPrompt(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
                {busy ? "Wait…" : "Download"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
