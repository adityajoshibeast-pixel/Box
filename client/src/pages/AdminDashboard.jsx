import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { upload } from "@vercel/blob/client";
import { api } from "../api.js";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(null);
  const [sections, setSections] = useState([]);
  const [openSection, setOpenSection] = useState(null);
  const [openSubsection, setOpenSubsection] = useState(null);

  const loadSections = useCallback(async () => {
    setSections(await api.getSections());
  }, []);

  useEffect(() => {
    api.checkAuth().then((r) => {
      if (!r.authed) navigate("/admin/login");
      else {
        setAuthed(true);
        loadSections();
      }
    });
  }, [navigate, loadSections]);

  if (authed !== true) return <div className="page">Checking access…</div>;

  const logout = async () => {
    await api.logout();
    navigate("/admin/login");
  };

  return (
    <div className="page admin-page">
      <header className="admin-header">
        <h1>Admin Panel</h1>
        <div className="admin-header-actions">
          <a href="/" target="_blank" rel="noreferrer" className="btn btn-ghost">
            View site
          </a>
          <button className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <p className="hint">
        Sections = initial page ke buttons. Har section ke andar subsections, aur har subsection ke
        andar items (link / PDF / image).
      </p>

      <NewThingForm placeholder="Naya section naam" onAdd={async (title) => { await api.createSection(title); loadSections(); }} />

      <div className="tree">
        {sections.map((s) => (
          <SectionBlock
            key={s.id}
            section={s}
            isOpen={openSection === s.id}
            onToggle={() => setOpenSection(openSection === s.id ? null : s.id)}
            onChanged={loadSections}
            openSubsection={openSubsection}
            setOpenSubsection={setOpenSubsection}
          />
        ))}
      </div>
    </div>
  );
}

function NewThingForm({ placeholder, onAdd, small }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    try {
      await onAdd(value.trim());
      setValue("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className={`inline-form ${small ? "inline-form-small" : ""}`} onSubmit={submit}>
      <input type="text" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      <button className="btn btn-primary" type="submit" disabled={busy}>
        Add
      </button>
    </form>
  );
}

function SectionBlock({ section, isOpen, onToggle, onChanged, openSubsection, setOpenSubsection }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [subsections, setSubsections] = useState([]);

  const loadSubs = useCallback(async () => {
    setSubsections(await api.getSubsections(section.id));
  }, [section.id]);

  useEffect(() => {
    if (isOpen) loadSubs();
  }, [isOpen, loadSubs]);

  const saveTitle = async () => {
    if (title.trim() && title !== section.title) await api.updateSection(section.id, title.trim());
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Delete section "${section.title}" and everything inside it?`)) return;
    await api.deleteSection(section.id);
    onChanged();
  };

  return (
    <div className="tree-node">
      <div className="tree-row">
        <button className="tree-toggle" onClick={onToggle}>
          {isOpen ? "▾" : "▸"}
        </button>
        {editing ? (
          <input
            className="inline-edit"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
            autoFocus
          />
        ) : (
          <span className="tree-label" onClick={() => setEditing(true)}>
            {section.title}
          </span>
        )}
        <div className="tree-actions">
          <button className="icon-btn" onClick={async () => { await api.reorderSection(section.id, "up"); onChanged(); }} title="Move up">
            ↑
          </button>
          <button className="icon-btn" onClick={async () => { await api.reorderSection(section.id, "down"); onChanged(); }} title="Move down">
            ↓
          </button>
          <button className="icon-btn danger" onClick={remove} title="Delete">
            ✕
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="tree-children">
          <NewThingForm
            small
            placeholder="Naya subsection naam"
            onAdd={async (t) => { await api.createSubsection(section.id, t); loadSubs(); }}
          />
          {subsections.map((ss) => (
            <SubsectionBlock
              key={ss.id}
              subsection={ss}
              isOpen={openSubsection === ss.id}
              onToggle={() => setOpenSubsection(openSubsection === ss.id ? null : ss.id)}
              onChanged={loadSubs}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubsectionBlock({ subsection, isOpen, onToggle, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(subsection.title);
  const [items, setItems] = useState([]);

  const loadItems = useCallback(async () => {
    setItems(await api.getItems(subsection.id));
  }, [subsection.id]);

  useEffect(() => {
    if (isOpen) loadItems();
  }, [isOpen, loadItems]);

  const saveTitle = async () => {
    if (title.trim() && title !== subsection.title) await api.updateSubsection(subsection.id, title.trim());
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Delete subsection "${subsection.title}" and its items?`)) return;
    await api.deleteSubsection(subsection.id);
    onChanged();
  };

  return (
    <div className="tree-node tree-node-nested">
      <div className="tree-row">
        <button className="tree-toggle" onClick={onToggle}>
          {isOpen ? "▾" : "▸"}
        </button>
        {editing ? (
          <input
            className="inline-edit"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
            autoFocus
          />
        ) : (
          <span className="tree-label" onClick={() => setEditing(true)}>
            {subsection.title}
          </span>
        )}
        <div className="tree-actions">
          <button className="icon-btn" onClick={async () => { await api.reorderSubsection(subsection.id, "up"); onChanged(); }}>↑</button>
          <button className="icon-btn" onClick={async () => { await api.reorderSubsection(subsection.id, "down"); onChanged(); }}>↓</button>
          <button className="icon-btn danger" onClick={remove}>✕</button>
        </div>
      </div>

      {isOpen && (
        <div className="tree-children">
          <NewItemForm subsectionId={subsection.id} onAdded={loadItems} />
          {items.map((it) => (
            <ItemRow key={it.id} item={it} onChanged={loadItems} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewItemForm({ subsectionId, onAdded }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Title chahiye.");
    if (type === "link" && !url.trim()) return setError("URL chahiye.");
    if (type !== "link" && !file) return setError("File chuno.");

    setBusy(true);
    try {
      if (type === "link") {
        await api.createItem(subsectionId, { title: title.trim(), type, url: url.trim() });
      } else {
        // Upload straight from the browser to Vercel Blob storage — this
        // skips the serverless function entirely, so large PDFs/images
        // don't hit any request-size limit.
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/admin/blob/token",
        });
        await api.createItem(subsectionId, {
          title: title.trim(),
          type,
          file_url: blob.url,
          download_url: `${blob.url}?download=1`,
          original_name: file.name,
        });
      }
      setTitle("");
      setUrl("");
      setFile(null);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="item-form" onSubmit={submit}>
      <input type="text" placeholder="Button ka text" value={title} onChange={(e) => setTitle(e.target.value)} />
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="link">Link</option>
        <option value="pdf">PDF</option>
        <option value="img">Image</option>
      </select>
      {type === "link" ? (
        <input type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
      ) : (
        <input
          type="file"
          accept={type === "pdf" ? "application/pdf" : "image/*"}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      )}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Adding…" : "Add item"}
      </button>
      {error && <span className="slip-error">{error}</span>}
    </form>
  );
}

function ItemRow({ item, onChanged }) {
  const remove = async () => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    await api.deleteItem(item.id);
    onChanged();
  };

  return (
    <div className="tree-row item-row">
      <span className="item-type-tag">{item.type}</span>
      <span className="tree-label">{item.title}</span>
      {item.type === "link" && (
        <a className="item-meta-link" href={item.url} target="_blank" rel="noreferrer">
          {item.url}
        </a>
      )}
      <div className="tree-actions">
        <button className="icon-btn" onClick={async () => { await api.reorderItem(item.id, "up"); onChanged(); }}>↑</button>
        <button className="icon-btn" onClick={async () => { await api.reorderItem(item.id, "down"); onChanged(); }}>↓</button>
        <button className="icon-btn danger" onClick={remove}>✕</button>
      </div>
    </div>
  );
}