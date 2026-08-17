const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const { nanoid } = require("nanoid");
const db = require("./db");
const { createSession, destroySession, requireAdmin, COOKIE_NAME } = require("./auth");

const app = express();
const PORT = process.env.PORT || 4000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
const PDF_DIR = path.join(UPLOAD_DIR, "pdf");
const IMG_DIR = path.join(UPLOAD_DIR, "img");
fs.mkdirSync(PDF_DIR, { recursive: true });
fs.mkdirSync(IMG_DIR, { recursive: true });

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// ---------- Multer (pdf / img upload, routed by item type) ----------
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    cb(null, req.body.type === "img" ? IMG_DIR : PDF_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, `${nanoid()}${path.extname(file.originalname) || ""}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (req.body.type === "pdf" && file.mimetype !== "application/pdf") {
      return cb(new Error("File must be a PDF"));
    }
    if (req.body.type === "img" && !file.mimetype.startsWith("image/")) {
      return cb(new Error("File must be an image"));
    }
    cb(null, true);
  },
});

/* =======================================================================
   ADMIN AUTH
   ======================================================================= */
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }
  const token = createSession();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  destroySession(req.cookies?.[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/admin/check", (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  res.json({ authed: !!token && require("./auth").isValid(token) });
});

/* =======================================================================
   PUBLIC VIEWER ROUTES
   ======================================================================= */
app.get("/api/sections", (_req, res) => {
  res.json(db.listSections());
});

app.get("/api/sections/:id/subsections", (req, res) => {
  res.json(db.listSubsections(req.params.id));
});

app.get("/api/subsections/:id/items", (req, res) => {
  res.json(db.listItems(req.params.id));
});

app.get("/api/items/:id", (req, res) => {
  const item = db.getItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

// Serve/download the actual PDF or image file for an item.
app.get("/api/items/:id/file", (req, res) => {
  const item = db.getItem(req.params.id);
  if (!item || !["pdf", "img"].includes(item.type)) {
    return res.status(404).json({ error: "Not found" });
  }
  const dir = item.type === "pdf" ? PDF_DIR : IMG_DIR;
  const filePath = path.join(dir, item.filename);
  if (!fs.existsSync(filePath)) return res.status(410).json({ error: "File missing on disk" });

  if (req.query.download === "1") {
    return res.download(filePath, item.original_name || item.filename);
  }
  res.sendFile(filePath);
});

/* =======================================================================
   ADMIN ROUTES (all protected)
   ======================================================================= */
const admin = express.Router();
admin.use(requireAdmin);

// -- sections --
admin.get("/sections", (_req, res) => res.json(db.listSections()));
admin.post("/sections", (req, res) => {
  const title = (req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "Title required" });
  res.status(201).json(db.createSection(title));
});
admin.put("/sections/:id", (req, res) => {
  const row = db.updateSection(req.params.id, (req.body.title || "").trim());
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});
admin.delete("/sections/:id", (req, res) => {
  db.deleteSection(req.params.id);
  res.status(204).end();
});
admin.post("/sections/:id/reorder", (req, res) => {
  db.reorderSection(req.params.id, req.body.direction === "up" ? -1 : 1);
  res.json({ ok: true });
});

// -- subsections --
admin.get("/sections/:id/subsections", (req, res) => res.json(db.listSubsections(req.params.id)));
admin.post("/sections/:id/subsections", (req, res) => {
  const title = (req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "Title required" });
  res.status(201).json(db.createSubsection(req.params.id, title));
});
admin.put("/subsections/:id", (req, res) => {
  const row = db.updateSubsection(req.params.id, (req.body.title || "").trim());
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});
admin.delete("/subsections/:id", (req, res) => {
  db.deleteSubsection(req.params.id);
  res.status(204).end();
});
admin.post("/subsections/:id/reorder", (req, res) => {
  db.reorderSubsection(req.params.id, req.body.direction === "up" ? -1 : 1);
  res.json({ ok: true });
});

// -- items --
admin.get("/subsections/:id/items", (req, res) => res.json(db.listItems(req.params.id)));

// Create item — multipart because pdf/img types carry a file; link type just needs a URL.
admin.post("/subsections/:id/items", upload.single("file"), (req, res) => {
  const { title, type, url } = req.body;
  if (!title || !type) return res.status(400).json({ error: "Title and type are required" });
  if (!["link", "pdf", "img"].includes(type)) return res.status(400).json({ error: "Invalid type" });

  const fields = { title: title.trim(), type };
  if (type === "link") {
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "A valid http(s) URL is required for a link" });
    }
    fields.url = url.trim();
  } else {
    if (!req.file) return res.status(400).json({ error: `A ${type} file is required` });
    fields.filename = req.file.filename;
    fields.original_name = req.file.originalname;
  }
  res.status(201).json(db.createItem(req.params.id, fields));
});

admin.put("/items/:id", upload.single("file"), (req, res) => {
  const existing = db.getItem(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const fields = {};
  if (req.body.title) fields.title = req.body.title.trim();
  if (existing.type === "link" && req.body.url) {
    if (!/^https?:\/\//i.test(req.body.url)) {
      return res.status(400).json({ error: "A valid http(s) URL is required" });
    }
    fields.url = req.body.url.trim();
  }
  if (req.file) {
    // replace the underlying file
    const dir = existing.type === "pdf" ? PDF_DIR : IMG_DIR;
    const oldPath = path.join(dir, existing.filename || "");
    if (existing.filename && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    fields.filename = req.file.filename;
    fields.original_name = req.file.originalname;
  }
  res.json(db.updateItem(req.params.id, fields));
});

admin.delete("/items/:id", (req, res) => {
  const row = db.deleteItem(req.params.id);
  if (row && ["pdf", "img"].includes(row.type) && row.filename) {
    const dir = row.type === "pdf" ? PDF_DIR : IMG_DIR;
    const p = path.join(dir, row.filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  res.status(204).end();
});
admin.post("/items/:id/reorder", (req, res) => {
  db.reorderItem(req.params.id, req.body.direction === "up" ? -1 : 1);
  res.json({ ok: true });
});

app.use("/api/admin", admin);

// ---------- Error handler ----------
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Something went wrong" });
});

// ---------- Serve built frontend (single-service deploy) ----------
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get("*", (_req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));
}

app.listen(PORT, () => console.log(`Menu app server running on port ${PORT}`));