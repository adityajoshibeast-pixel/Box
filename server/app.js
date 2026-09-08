const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { handleUpload } = require("@vercel/blob/client");

const db = require("./db");
const {
  createToken,
  verifyToken,
  requireAdmin,
  COOKIE_NAME,
} = require("./auth");

const { deleteFile } = require("./blob");
const { deleteCloudinaryFile } = require("./cloudinary");
const {
  sendNewItemNotification,
  sendDownloadNotification,
} = require("./notifications");

const app = express();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const IS_PROD = process.env.NODE_ENV === "production";

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false, limit: "4kb" }));

// --------------------------------------------------
// Cookies
// --------------------------------------------------

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax",
  secure: IS_PROD,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function requestIsAdmin(req) {
  const token = req.cookies?.[COOKIE_NAME];
  return Boolean(token && verifyToken(token));
}

async function publishDueScheduledItems(req) {
  const publishedItems = await db.publishDueItems(new Date());
  const results = [];

  for (const item of publishedItems) {
    try {
      const notification = await sendNewItemNotification({ db, req, item });
      results.push({ itemId: item.id, notification });
    } catch (notificationError) {
      console.error("Scheduled publish notification failed:", notificationError);
      results.push({ itemId: item.id, notification: { sent: 0, failed: true } });
    }
  }

  return { published: publishedItems.length, results };
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    message: "API is working",
  });
});

// --------------------------------------------------
// ADMIN AUTH
// --------------------------------------------------

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      error: "Wrong password",
    });
  }

  res.cookie(COOKIE_NAME, createToken(), cookieOpts);

  res.json({
    ok: true,
  });
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);

  res.json({
    ok: true,
  });
});

app.get("/api/admin/check", (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];

  res.json({
    authed: !!token && verifyToken(token),
  });
});

// --------------------------------------------------
// VERCEL BLOB UPLOAD
// --------------------------------------------------

app.post("/api/admin/blob/token", requireAdmin, async (req, res) => {
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,

      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/pdf",
          "image/*",
        ],
        addRandomSuffix: true,
      }),

      onUploadCompleted: async () => {
        // Client saves item metadata after upload.
      },
    });

    res.json(jsonResponse);
  } catch (err) {
    console.error("Blob upload error:", err);

    res.status(400).json({
      error: err.message || "Upload failed",
    });
  }
});

// --------------------------------------------------
// PUBLIC ROUTES
// --------------------------------------------------

app.get("/api/sections", async (req, res, next) => {
  try {
    await publishDueScheduledItems(req);
    const sections = await db.listSections();

    res.json(sections);
  } catch (err) {
    next(err);
  }
});

app.get("/api/sections/:id/subsections", async (req, res, next) => {
  try {
    const subsections = await db.listSubsections(
      req.params.id
    );

    res.json(subsections);
  } catch (err) {
    next(err);
  }
});

app.get("/api/subsections/:id/items", async (req, res, next) => {
  try {
    const items = await db.listItems(
      req.params.id,
      { includePrivate: requestIsAdmin(req) }
    );

    res.json(items);
  } catch (err) {
    next(err);
  }
});

app.get("/api/items/:id", async (req, res, next) => {
  try {
    const item = await db.getItem(req.params.id, {
      includePrivate: requestIsAdmin(req),
    });

    if (!item) {
      return res.status(404).json({
        error: "Not found",
      });
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
});

app.post("/api/items/:id/download", async (req, res, next) => {
  try {
    const item = await db.getItem(req.params.id, {
      includePrivate: requestIsAdmin(req),
    });

    if (!item || !["pdf", "img"].includes(item.type)) {
      return res.status(404).json({ error: "File not found" });
    }

    const target = item.download_url || item.file_url;
    let downloadUrl;

    try {
      downloadUrl = new URL(target);
      if (!["http:", "https:"].includes(downloadUrl.protocol)) {
        throw new Error("Unsupported download URL");
      }
    } catch {
      return res.status(404).json({ error: "Download is unavailable" });
    }

    try {
      await sendDownloadNotification({ db, req, item });
    } catch (notificationError) {
      // Email-provider problems must never stop the requested download.
      console.error("Download notification failed:", notificationError);
    }

    res.set("Cache-Control", "private, no-store");
    return res.redirect(302, downloadUrl.toString());
  } catch (err) {
    next(err);
  }
});

app.get("/api/cron/publish-scheduled", async (req, res, next) => {
  try {
    const cronSecret = String(process.env.CRON_SECRET || "").trim();
    if (cronSecret && req.get("authorization") !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await publishDueScheduledItems(req);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// UPDATE SUBSCRIPTIONS
// --------------------------------------------------

const subscribeAttempts = new Map();

app.post("/api/subscribe", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const honeypot = String(req.body?.website || "").trim();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const recentAttempts = (subscribeAttempts.get(ip) || []).filter(
      (time) => now - time < 60 * 60 * 1000
    );

    if (honeypot) return res.status(200).json({ ok: true });
    if (recentAttempts.length >= 10) {
      return res.status(429).json({ error: "Too many attempts. Please try again later." });
    }
    subscribeAttempts.set(ip, [...recentAttempts, now]);

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)
    ) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    await db.subscribe(email);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post("/api/unsubscribe", async (req, res, next) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token || token.length > 100) {
      return res.status(400).json({ error: "Invalid unsubscribe link." });
    }
    await db.unsubscribe(token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// ADMIN ROUTER
// --------------------------------------------------

const admin = express.Router();

admin.use(requireAdmin);

// --------------------------------------------------
// SECTIONS
// --------------------------------------------------

admin.post("/sections", async (req, res, next) => {
  try {
    const title = (req.body.title || "").trim();

    if (!title) {
      return res.status(400).json({
        error: "Title required",
      });
    }

    const section = await db.createSection(title);

    res.status(201).json(section);
  } catch (err) {
    next(err);
  }
});

admin.put("/sections/:id", async (req, res, next) => {
  try {
    const title = (req.body.title || "").trim();

    const row = await db.updateSection(
      req.params.id,
      title
    );

    if (!row) {
      return res.status(404).json({
        error: "Not found",
      });
    }

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
    const direction =
      req.body.direction === "up"
        ? -1
        : 1;

    await db.reorderSection(
      req.params.id,
      direction
    );

    res.json({
      ok: true,
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// SUBSECTIONS
// --------------------------------------------------

admin.post(
  "/sections/:id/subsections",
  async (req, res, next) => {
    try {
      const title = (req.body.title || "").trim();

      if (!title) {
        return res.status(400).json({
          error: "Title required",
        });
      }

      const subsection = await db.createSubsection(
        req.params.id,
        title
      );

      res.status(201).json(subsection);
    } catch (err) {
      next(err);
    }
  }
);

admin.put("/subsections/:id", async (req, res, next) => {
  try {
    const title = (req.body.title || "").trim();

    const row = await db.updateSubsection(
      req.params.id,
      title
    );

    if (!row) {
      return res.status(404).json({
        error: "Not found",
      });
    }

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

admin.post(
  "/subsections/:id/reorder",
  async (req, res, next) => {
    try {
      const direction =
        req.body.direction === "up"
          ? -1
          : 1;

      await db.reorderSubsection(
        req.params.id,
        direction
      );

      res.json({
        ok: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// --------------------------------------------------
// ITEMS
// --------------------------------------------------

admin.post("/subsections/:id/items", async (req, res, next) => {
  try {
    const { title, type, url, file_url, download_url, original_name, provider, public_id, resource_type } =
      req.body;
    if (!title || !type) return res.status(400).json({ error: "Title and type are required" });
    if (!["link", "pdf", "img"].includes(type)) return res.status(400).json({ error: "Invalid type" });

    const requestedVisibility = req.body.visibility === "private" ? "private" : "public";
    const publishAfterDays = Number(req.body.publish_after_days);
    const hasSchedule =
      type !== "link" &&
      Number.isInteger(publishAfterDays) &&
      publishAfterDays >= 1 &&
      publishAfterDays <= 7;
    const fields = {
      title: title.trim(),
      type,
      visibility: type === "link" ? "public" : hasSchedule ? "private" : requestedVisibility,
    };
    if (hasSchedule) {
      fields.scheduled_publish_at = new Date(
        Date.now() + publishAfterDays * 24 * 60 * 60 * 1000
      );
    }
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
      fields.provider = provider || "blob"; // "blob" or "cloudinary"
      if (public_id) fields.public_id = public_id;
      if (resource_type) fields.resource_type = resource_type;
    }
    const item = await db.createItem(req.params.id, fields);
    let notification = { sent: 0, withheld: fields.visibility !== "public" };

    if (fields.visibility === "public") {
      try {
        notification = await sendNewItemNotification({ db, req, item });
      } catch (notificationError) {
        // The resource is already safely stored, so an email-provider outage
        // must not make the admin retry and accidentally create a duplicate.
        console.error("Update notification failed:", notificationError);
        notification = { sent: 0, failed: true };
      }
    }

    res.status(201).json({ ...item, notification });
  } catch (err) {
    next(err);
  }
});

admin.put("/items/:id/visibility", async (req, res, next) => {
  try {
    const existing = await db.getItem(req.params.id, { includePrivate: true });
    if (!existing || !["pdf", "img"].includes(existing.type)) {
      return res.status(404).json({ error: "File not found" });
    }

    const visibility = req.body?.visibility === "public" ? "public" : "private";
    const wasPublic = existing.visibility !== "private";
    const updated = await db.setItemVisibility(req.params.id, visibility);
    let notification = { sent: 0 };

    if (visibility === "public" && !wasPublic) {
      try {
        notification = await sendNewItemNotification({ db, req, item: updated });
      } catch (notificationError) {
        console.error("Visibility update notification failed:", notificationError);
        notification = { sent: 0, failed: true };
      }
    }

    res.json({ ...updated, notification });
  } catch (err) {
    next(err);
  }
});

admin.put("/items/:id/schedule", async (req, res, next) => {
  try {
    const existing = await db.getItem(req.params.id, { includePrivate: true });
    if (!existing || !["pdf", "img"].includes(existing.type)) {
      return res.status(404).json({ error: "File not found" });
    }

    if (req.body?.days === null) {
      const updated = await db.scheduleItem(req.params.id, null);
      return res.json(updated);
    }

    const days = Number(req.body?.days);
    if (!Number.isInteger(days) || days < 1 || days > 7) {
      return res.status(400).json({ error: "Schedule must be between 1 and 7 days" });
    }

    const publishAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const updated = await db.scheduleItem(req.params.id, publishAt);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

admin.put("/items/:id", async (req, res, next) => {
  try {
    const existing = await db.getItem(req.params.id, { includePrivate: true });

    if (!existing) {
      return res.status(404).json({
        error: "Not found",
      });
    }

    const fields = {};

    if (req.body.title) {
      fields.title =
        req.body.title.trim();
    }

    if (
      existing.type === "link" &&
      req.body.url
    ) {
      if (
        !/^https?:\/\//i.test(req.body.url)
      ) {
        return res.status(400).json({
          error:
            "A valid http(s) URL is required",
        });
      }

      fields.url =
        req.body.url.trim();
    }

    if (req.body.file_url) {
      // delete the old file from wherever it actually lives
      if (existing.provider === "cloudinary") {
        await deleteCloudinaryFile(existing.public_id, existing.resource_type);
      } else {
        await deleteFile(existing.file_url);
      }
      fields.file_url = req.body.file_url;
      fields.download_url = req.body.download_url || req.body.file_url;
      fields.original_name = req.body.original_name || existing.original_name;
      fields.provider = req.body.provider || "blob";
      if (req.body.public_id) fields.public_id = req.body.public_id;
      if (req.body.resource_type) fields.resource_type = req.body.resource_type;
    }

    const updated = await db.updateItem(
      req.params.id,
      fields
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

admin.delete("/items/:id", async (req, res, next) => {
  try {
    const row = await db.deleteItem(req.params.id);
    if (row && row.file_url) {
      if (row.provider === "cloudinary") {
        await deleteCloudinaryFile(row.public_id, row.resource_type);
      } else {
        await deleteFile(row.file_url);
      }
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

admin.post(
  "/items/:id/reorder",
  async (req, res, next) => {
    try {
      const direction =
        req.body.direction === "up"
          ? -1
          : 1;

      await db.reorderItem(
        req.params.id,
        direction
      );

      res.json({
        ok: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// --------------------------------------------------
// MOUNT ADMIN ROUTES
// --------------------------------------------------

app.use("/api/admin", admin);

// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use((err, _req, res, _next) => {
  console.error("API ERROR:", err);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    error:
      err.message ||
      "Internal server error",
  });
});

// --------------------------------------------------
// EXPORT
// --------------------------------------------------

module.exports = app;
