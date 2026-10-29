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
const { nanoid } = require("nanoid");
const { getPresignedUploadUrl, getPresignedDownloadUrl, deleteB2File } = require("./b2");
const {
  sendNewItemNotification,
  sendDownloadNotification,
} = require("./notifications");

const app = express();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const IS_PROD = process.env.NODE_ENV === "production";

// Small CDN caches make repeat navigation fast without materially delaying
// editorial changes. Item feeds deliberately remain uncached below because
// their visibility can change on a schedule.
const PUBLIC_NAVIGATION_CACHE = "public, s-maxage=10, stale-while-revalidate=30";

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

/* =======================================================================
   B2 PRESIGNED UPLOAD (browser uploads straight to Backblaze B2 using this)
   ======================================================================= */
app.post("/api/admin/b2/presign", requireAdmin, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename) return res.status(400).json({ error: "filename is required" });
    const key = `${nanoid()}-${filename}`.replace(/\s+/g, "_");
    const { uploadUrl } = await getPresignedUploadUrl(key, contentType);
    res.json({ uploadUrl, key });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --------------------------------------------------
// PUBLIC ROUTES
// --------------------------------------------------

app.get("/api/sections", async (req, res, next) => {
  try {
    publishDueScheduledItems(req).catch((err) =>
      console.error("Background scheduled publish check failed:", err)
    );
    const sections = await db.listSections();
    res.set("Cache-Control", PUBLIC_NAVIGATION_CACHE);
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
    res.set("Cache-Control", PUBLIC_NAVIGATION_CACHE);
    res.json(subsections);
  } catch (err) {
    next(err);
  }
});

app.get("/api/sections/:id", async (req, res, next) => {
  try {
    const section = await db.getSection(req.params.id);
    if (!section) return res.status(404).json({ error: "Not found" });
    res.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
    res.json(section);
  } catch (err) {
    next(err);
  }
});

app.get("/api/subsections/:id", async (req, res, next) => {
  try {
    const subsection = await db.getSubsection(req.params.id);
    if (!subsection) return res.status(404).json({ error: "Not found" });
    res.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
    res.json(subsection);
  } catch (err) {
    next(err);
  }
});

app.get("/api/subsections/:id/items", async (req, res, next) => {
  try {
    // Non-blocking background check so visitor response is served instantly
    publishDueScheduledItems(req).catch((err) =>
      console.error("Background scheduled publish check failed:", err)
    );
    const items = await db.listItems(req.params.id);

    res.set("Cache-Control", "private, no-store");
    res.json(items);
  } catch (err) {
    next(err);
  }
});

app.get("/api/items/:id", async (req, res, next) => {
  try {
    const item = await db.getItem(req.params.id);

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

function getItemContentType(item) {
  if (!item) return undefined;
  if (item.type === "pdf") return "application/pdf";
  if (item.type === "mp4" || item.type === "video") return "video/mp4";
  if (item.type === "img") {
    const name = String(item.original_name || item.key || "").toLowerCase();
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".svg")) return "image/svg+xml";
    if (name.endsWith(".gif")) return "image/gif";
    return "image/jpeg";
  }
  return undefined;
}

// B2's bucket stays private, so every view/download needs a freshly-signed
// URL — this route generates one and redirects to it. Public, no auth
// needed (same as viewing the item itself).
app.get("/api/items/:id/open", async (req, res, next) => {
  try {
    const item = await db.getItem(req.params.id);
    if (!item || item.provider !== "b2") return res.status(404).json({ error: "Not found" });
    const url = await getPresignedDownloadUrl(item.key, {
      download: req.query.download === "1",
      filename: item.original_name,
      contentType: getItemContentType(item),
    });
    // The redirect itself is safe to reuse briefly in this browser: the
    // target remains signed for one hour and the item is already public.
    if (req.query.download !== "1") {
      res.set("Cache-Control", "private, max-age=300");
    }
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

async function resolveDownloadUrl(item) {
  if (item.provider === "b2") {
    const presigned = await getPresignedDownloadUrl(item.key, {
      download: true,
      filename: item.original_name,
      contentType: getItemContentType(item),
    });
    return new URL(presigned);
  }
  const target = item.download_url || item.file_url;
  const downloadUrl = new URL(target);
  if (!["http:", "https:"].includes(downloadUrl.protocol)) {
    throw new Error("Unsupported download URL");
  }
  return downloadUrl;
}

app.post("/api/items/:id/download", async (req, res, next) => {
  try {
    const item = await db.getItem(req.params.id);

    if (!item || !["pdf", "img", "mp4", "video"].includes(item.type)) {
      return res.status(404).json({ error: "File not found" });
    }

    let downloadUrl;
    try {
      downloadUrl = await resolveDownloadUrl(item);
    } catch (resolveErr) {
      console.error("Resolve download error:", resolveErr.message);
      return res.status(404).json({ error: "Download is unavailable" });
    }

    // Send owner notification in background so download starts in milliseconds
    sendDownloadNotification({ db, req, item }).catch((notificationError) => {
      console.error("Download notification failed:", notificationError);
    });

    res.set("Cache-Control", "private, no-store");
    return res.json({ ok: true, downloadUrl: downloadUrl.toString() });
  } catch (err) {
    next(err);
  }
});

app.get("/api/items/:id/download", async (req, res, next) => {
  try {
    const item = await db.getItem(req.params.id);

    if (!item || !["pdf", "img", "mp4", "video"].includes(item.type)) {
      return res.status(404).json({ error: "File not found" });
    }

    let downloadUrl;
    try {
      downloadUrl = await resolveDownloadUrl(item);
    } catch (resolveErr) {
      console.error("Resolve download error:", resolveErr.message);
      return res.status(404).json({ error: "Download is unavailable" });
    }

    sendDownloadNotification({ db, req, item }).catch((notificationError) => {
      console.error("Download notification failed:", notificationError);
    });

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

admin.get("/subsections/:id/items", async (req, res, next) => {
  try {
    publishDueScheduledItems(req).catch((err) =>
      console.error("Admin background publish check failed:", err)
    );
    const items = await db.listItems(req.params.id, { includePrivate: true });
    res.set("Cache-Control", "private, no-store");
    res.json(items);
  } catch (err) {
    next(err);
  }
});

admin.post("/subsections/:id/items", async (req, res, next) => {
  try {
    const { title, type, url, file_url, download_url, original_name, provider, public_id, resource_type, key } =
      req.body;
    if (!title || !type) return res.status(400).json({ error: "Title and type are required" });
    if (!["link", "pdf", "img", "mp4", "video"].includes(type)) return res.status(400).json({ error: "Invalid type" });

    const requestedVisibility = req.body.visibility === "private" ? "private" : "public";
    const publishAfterMinutes = Number(req.body.publish_after_minutes);
    const publishAfterDays = Number(req.body.publish_after_days);
    const hasMinuteSchedule = type !== "link" && publishAfterMinutes === 1;
    const hasDaySchedule =
      type !== "link" &&
      Number.isInteger(publishAfterDays) &&
      publishAfterDays >= 1 &&
      publishAfterDays <= 7;
    const hasSchedule = hasMinuteSchedule || hasDaySchedule;
    const fields = {
      title: title.trim(),
      type,
      visibility: type === "link" ? "public" : hasSchedule ? "private" : requestedVisibility,
    };
    if (hasSchedule) {
      fields.scheduled_publish_at = new Date(
        Date.now() +
          (hasMinuteSchedule ? 60 * 1000 : publishAfterDays * 24 * 60 * 60 * 1000)
      );
    }
    if (type === "link") {
      if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: "A valid http(s) URL is required for a link" });
      }
      fields.url = url.trim();
    } else {
      if (!file_url && !(provider === "b2" && key)) {
        return res.status(400).json({ error: `A ${type} file is required` });
      }
      if (file_url) {
        fields.file_url = file_url;
        fields.download_url = download_url || file_url;
      }

      fields.original_name = original_name || title;
      fields.provider = provider || "blob"; // "blob" or "cloudinary"
      if (public_id) fields.public_id = public_id;
      if (resource_type) fields.resource_type = resource_type;
      if (key) fields.key = key;
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
    if (!existing || !["pdf", "img", "mp4", "video"].includes(existing.type)) {
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
    if (!existing || !["pdf", "img", "mp4", "video"].includes(existing.type)) {
      return res.status(404).json({ error: "File not found" });
    }

    if (req.body?.days === null) {
      const updated = await db.scheduleItem(req.params.id, null);
      return res.json(updated);
    }

    const minutes = Number(req.body?.minutes);
    const days = Number(req.body?.days);
    const isMinuteTest = minutes === 1;
    if (!isMinuteTest && (!Number.isInteger(days) || days < 1 || days > 7)) {
      return res.status(400).json({ error: "Schedule must be between 1 and 7 days" });
    }

    const publishAt = new Date(
      Date.now() + (isMinuteTest ? 60 * 1000 : days * 24 * 60 * 60 * 1000)
    );
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

    if (req.body.file_url || (req.body.provider === "b2" && req.body.key)) {
      // delete the old file from wherever it actually lives
      if (existing.provider === "cloudinary") {
        await deleteCloudinaryFile(existing.public_id, existing.resource_type);
      } else if (existing.provider === "b2") {
        await deleteB2File(existing.key);
      } else {
        await deleteFile(existing.file_url);
      }
      fields.file_url = req.body.file_url;
      fields.download_url = req.body.download_url || req.body.file_url;
      fields.original_name = req.body.original_name || existing.original_name;
      fields.provider = req.body.provider || "b2";
      if (req.body.key) fields.key = req.body.key;
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
    if (row && (row.file_url || row.key)) {
      if (row.provider === "cloudinary") {
        await deleteCloudinaryFile(row.public_id, row.resource_type);
      } else if (row.provider === "b2") {
        await deleteB2File(row.key);
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
