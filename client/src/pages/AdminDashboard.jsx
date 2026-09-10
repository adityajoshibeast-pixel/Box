import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { upload } from "@vercel/blob/client";
import { uploadToCloudinary } from "../cloudinaryUpload.js";
import { api } from "../api.js";

// Files under this size go to Cloudinary, larger ones go to Vercel Blob —
// spreads usage across both free tiers instead of maxing out one.
const CLOUDINARY_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(null);
  const [sections, setSections] = useState([]);
  const [openSection, setOpenSection] = useState(null);
  const [openSubsection, setOpenSubsection] = useState(null);

  const loadSections = useCallback(async () => {
    try {
      const data = await api.getSections();
      setSections(data || []);
    } catch (err) {
      console.error("Failed to load sections in admin:", err);
    }
  }, []);

  useEffect(() => {
    api.checkAuth()
      .then((r) => {
        if (!r?.authed) navigate("/admin/login");
        else {
          setAuthed(true);
          loadSections();
        }
      })
      .catch((err) => {
        console.error("Auth check failed:", err);
        navigate("/admin/login");
      });
  }, [navigate, loadSections]);

  if (authed !== true) return <div className="page"><p className="hint">Checking access…</p></div>;

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
    try {
      setItems(await api.getAdminItems(subsection.id));
    } catch (error) {
      console.error("Admin items refresh failed:", error);
    }
  }, [subsection.id]);

  useEffect(() => {
    if (!isOpen) return undefined;
    loadItems();
    const timer = window.setInterval(loadItems, 10_000);
    return () => window.clearInterval(timer);
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
  const [publishChoice, setPublishChoice] = useState("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!title.trim()) return setError("Title chahiye.");
    if (type === "link" && !url.trim()) return setError("URL chahiye.");
    if (type !== "link" && !file) return setError("File chuno.");

    setBusy(true);
    try {
      let created;
      const publicationFields = publishChoice === "schedule-minute"
        ? { visibility: "private", publish_after_minutes: 1 }
        : publishChoice.startsWith("schedule-")
        ? {
            visibility: "private",
            publish_after_days: Number(publishChoice.replace("schedule-", "")),
          }
        : { visibility: publishChoice };
      if (type === "link") {
        created = await api.createItem(subsectionId, { title: title.trim(), type, url: url.trim() });
      } else {
        const resourceType = type === "pdf" ? "raw" : "image";
        let fields;

        if (file.size < CLOUDINARY_SIZE_LIMIT) {
          // Small file — goes to Cloudinary, straight from the browser.
          const result = await uploadToCloudinary(file, resourceType);
          fields = {
            ...publicationFields,
            title: title.trim(),
            type,
            provider: "cloudinary",
            file_url: result.secure_url,
            download_url: result.secure_url.replace("/upload/", "/upload/fl_attachment/"),
            public_id: result.public_id,
            resource_type: result.resource_type,
            original_name: file.name,
          };
        } else {
          // Large file — goes to Vercel Blob, also straight from the
          // browser, so it skips the serverless function's body-size limit.
          const blob = await upload(file.name, file, {
            access: "public",
            handleUploadUrl: "/api/admin/blob/token",
          });
          fields = {
            ...publicationFields,
            title: title.trim(),
            type,
            provider: "blob",
            file_url: blob.url,
            download_url: `${blob.url}?download=1`,
            original_name: file.name,
          };
        }
        created = await api.createItem(subsectionId, fields);
      }
      if (created?.notification?.withheld) {
        setNotice(
          created.scheduled_publish_at
            ? `Item private hai aur ${new Date(created.scheduled_publish_at).toLocaleString("en-IN")} ko public hoga.`
            : "Item private add ho gaya. Koi update email nahi bheja gaya."
        );
      } else if (created?.notification?.failed) {
        setNotice("Item add ho gaya, lekin update emails send nahi ho paaye.");
      } else if (created?.notification?.skipped) {
        setNotice("Item add ho gaya. Update email service abhi configure nahi hai.");
      } else if (created?.notification?.sent > 0) {
        setNotice(`Item add ho gaya aur ${created.notification.sent} update email send hue.`);
      } else {
        setNotice("Item add ho gaya. Abhi koi active subscriber nahi hai.");
      }
      setTitle("");
      setUrl("");
      setFile(null);
      setPublishChoice("public");
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
      {type !== "link" && (
        <select
          aria-label="Initial file visibility"
          value={publishChoice}
          onChange={(e) => setPublishChoice(e.target.value)}
        >
          <option value="public">Public now</option>
          <option value="private">Keep private</option>
          <option value="schedule-minute">Public in 1 minute (test)</option>
          {Array.from({ length: 7 }, (_, index) => index + 1).map((days) => (
            <option key={days} value={`schedule-${days}`}>
              Public in {days} {days === 1 ? "day" : "days"}
            </option>
          ))}
        </select>
      )}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Adding…" : "Add item"}
      </button>
      {error && <span className="slip-error">{error}</span>}
      {notice && <span className="item-notice" role="status">{notice}</span>}
    </form>
  );
}

function ItemRow({ item, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isFile = ["pdf", "img"].includes(item.type);
  const isPublic = item.visibility !== "private";
  const scheduledAt = item.scheduled_publish_at
    ? new Date(item.scheduled_publish_at)
    : null;

  const remove = async () => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    await api.deleteItem(item.id);
    onChanged();
  };

  const toggleVisibility = async () => {
    setBusy(true);
    setMessage("");
    try {
      const updated = await api.setItemVisibility(
        item.id,
        isPublic ? "private" : "public"
      );
      if (updated?.notification?.failed) {
        setMessage("Public ho gaya, lekin update email send nahi hua.");
      } else if (!isPublic && updated?.notification?.sent > 0) {
        setMessage(`Public ho gaya; ${updated.notification.sent} update email send hue.`);
      } else {
        setMessage(isPublic ? "File private ho gayi." : "File public ho gayi.");
      }
      onChanged();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const setSchedule = async (event) => {
    const selection = event.target.value;
    if (!selection) return;
    const isMinuteTest = selection === "minute";
    const days = Number(selection);
    setBusy(true);
    setMessage("");
    try {
      const updated = await api.scheduleItem(
        item.id,
        isMinuteTest ? { minutes: 1 } : days
      );
      setMessage(
        `${isMinuteTest ? "1 minute" : `${days} ${days === 1 ? "day" : "days"}`} baad public hoga (${new Date(
          updated.scheduled_publish_at
        ).toLocaleString("en-IN")}).`
      );
      onChanged();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const cancelSchedule = async () => {
    setBusy(true);
    setMessage("");
    try {
      await api.scheduleItem(item.id, null);
      setMessage("Schedule cancel ho gaya; file private rahegi.");
      onChanged();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="item-admin-card">
      <div className="tree-row item-row">
        <span className="item-type-tag">{item.type}</span>
        {item.provider && <span className="item-type-tag">{item.provider}</span>}
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
      {isFile && (
        <div className="publish-controls">
          <button
            className={`visibility-switch ${isPublic ? "is-public" : "is-private"}`}
            type="button"
            role="switch"
            aria-checked={isPublic}
            onClick={toggleVisibility}
            disabled={busy}
          >
            <span className="visibility-switch-track" aria-hidden="true">
              <span className="visibility-switch-thumb" />
            </span>
            {isPublic ? "Public" : "Private"}
          </button>
          <select
            className="schedule-select"
            aria-label={`Schedule ${item.title}`}
            defaultValue=""
            onChange={setSchedule}
            disabled={busy}
          >
            <option value="" disabled>Schedule publish…</option>
            <option value="minute">In 1 minute (test)</option>
            {Array.from({ length: 7 }, (_, index) => index + 1).map((days) => (
              <option key={days} value={days}>
                In {days} {days === 1 ? "day" : "days"}
              </option>
            ))}
          </select>
          {scheduledAt && (
            <>
              <span className="scheduled-time">
                Scheduled: {scheduledAt.toLocaleString("en-IN")}
              </span>
              <button className="schedule-cancel" type="button" onClick={cancelSchedule} disabled={busy}>
                Cancel
              </button>
            </>
          )}
          {busy && <span className="scheduled-time">Saving…</span>}
        </div>
      )}
      {message && <div className="item-row-message" role="status">{message}</div>}
    </div>
  );
}
