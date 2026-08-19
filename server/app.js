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

// --------------------------------------------------
// Cookies
// --------------------------------------------------

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax",
  secure: IS_PROD,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

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

app.get("/api/sections", async (_req, res, next) => {
  try {
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
      req.params.id
    );

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
      fields.provider = provider || "blob"; // "blob" or "cloudinary"
      if (public_id) fields.public_id = public_id;
      if (resource_type) fields.resource_type = resource_type;
    }
    res.status(201).json(await db.createItem(req.params.id, fields));
  } catch (err) {
    next(err);
  }
});

admin.put("/items/:id", async (req, res, next) => {
  try {
    const existing = await db.getItem(
      req.params.id
    );

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