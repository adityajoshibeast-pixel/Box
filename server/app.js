const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { handleUpload } = require("@vercel/blob/client");
const db = require("./db");
const { createToken, verifyToken, requireAdmin, COOKIE_NAME } = require("./auth");
const { deleteFile } = require("./blob");

const app = express();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const IS_PROD = process.env.NODE_ENV === "production";

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax",
  secure: IS_PROD,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

/* =======================================================================
   ADMIN AUTH
   ======================================================================= */
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }
  res.cookie(COOKIE_NAME, createToken(), cookieOpts);
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/admin/check", (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  res.json({ authed: !!token && verifyToken(token) });
});

/* =======================================================================
   FILE UPLOAD TOKEN (browser uploads straight to Vercel Blob using this)
   ======================================================================= */
app.post("/api/admin/blob/token", requireAdmin, async (req, res) => {
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf", "image/*"],
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // No action needed — the client saves item metadata itself
        // via /api/admin/subsections/:id/items right after upload.
      },
    });
    res.json(jsonResponse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* =======================================================================
   PUBLIC VIEWER ROUTES
   ======================================================================= */
app.get("/api/sections", async (_req, res, next) => {
  try {
    res.json(await db.listSections());
  } catch (err) {
    next(err);
  }
});

app.get("/api/sections/:id/subsections", async (req, res, next) => {
  try {
    res.json(await db.listSubsections(req.params.id));
  } catch (err) {
    next(err);
  }
});

app.get("/api/subsections/:id/items", async (req, res, next) => {
  try {
    res.json(await db.listItems(req.params.id));
  } catch (err) {
    next(err);
  }
});

app.get("/api/items/:id", async (req, res, next) => {
  try {
    const item = await db.getItem(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

/* =======================================================================
   ADMIN ROUTES (all protected)
   ======================================================================= */
const admin = express.Router();
admin.use(requireAdmin);

// -- sections --
admin.post("/sections", async (req, res, next) => {
  try {
    const title = (req.body.title || "").trim();
    if (!title) return res.status(400).json({ error: "Title required" });
    res.status(201).json(await db.createSection(title));
  } catch (err) {
    next(err);
  }
});
admin.put("/sections/:id", async (req, res, next) => {
  try {
    const row = await db.updateSection(req.params.id, (req.body.title || "").trim());
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});
admin.delete("/sections/:id", async (req, res, next) => {
  try {
    await db.deleteSection(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
admin.post("/sections/:id/reorder", async (req, res, next) => {
  try {
    await db.reorderSection(req.params.id, req.body.direction === "up" ? -1 : 1);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// -- subsections --
admin.post("/sections/:id/subsections", async (req, res, next) => {
  try {
    const title = (req.body.title || "").trim();
    if (!title) return res.status(400).json({ error: "Title required" });
    res.status(201).json(await db.createSubsection(req.params.id, title));
  } catch (err) {
    next(err);
  }
});
admin.put("/subsections/:id", async (req, res, next) => {
  try {
    const row = await db.updateSubsection(req.params.id, (req.body.title || "").trim());
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});
admin.delete("/subsections/:id", async (req, res, next) => {
  try {
    await db.deleteSubsection(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
admin.post("/subsections/:id/reorder", async (req, res, next) => {
  try {
    await db.reorderSubsection(req.params.id, req.body.direction === "up" ? -1 : 1);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// -- items --
// The file (if any) has already been uploaded straight to Vercel Blob by the
// browser before this runs. This just saves the metadata + the blob URLs.
admin.post("/subsections/:id/items", async (req, res, next) => {
  try {
    const { title, type, url, file_url, download_url, original_name } = req.body;
    if (!title || !type) return res.status(400).json({ error: "Title and type are required" });
    if (!["link", "pdf", "img"].includes(type)) return res.status(400).json({ error: "Invalid type" });

    const fields = { title: title.trim(), type };
    if (type === "link") {
      if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: "A valid http(s) URL is required for a link" });
      }
      fields.url = url.trim();
    } else {
      if (!file_url) return res.status(400).json({ error: `A ${type} file is required` });
      fields.file_url = file_url;
      fields.download_url = download_url || file_url;
      fields.original_name = original_name || title;
    }
    res.status(201).json(await db.createItem(req.params.id, fields));
  } catch (err) {
    next(err);
  }
});

admin.put("/items/:id", async (req, res, next) => {
  try {
    const existing = await db.getItem(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    const fields = {};
    if (req.body.title) fields.title = req.body.title.trim();
    if (existing.type === "link" && req.body.url) {
      if (!/^https?:\/\//i.test(req.body.url)) {
        return res.status(400).json({ error: "A valid http(s) URL is required" });
      }
      fields.url = req.body.url.trim();
    }
    if (req.body.file_url) {
      await deleteFile(existing.file_url);
      fields.file_url = req.body.file_url;
      fields.download_url = req.body.download_url || req.body.file_url;
      fields.original_name = req.body.original_name || existing.original_name;
    }
    res.json(await db.updateItem(req.params.id, fields));
  } catch (err) {
    next(err);
  }
});

admin.delete("/items/:id", async (req, res, next) => {
  try {
    const row = await db.deleteItem(req.params.id);
    if (row && row.file_url) await deleteFile(row.file_url);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
admin.post("/items/:id/reorder", async (req, res, next) => {
  try {
    await db.reorderItem(req.params.id, req.body.direction === "up" ? -1 : 1);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.use("/api/admin", admin);

// ---------- Error handler ----------
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Something went wrong" });
});

module.exports = app;