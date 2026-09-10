const { MongoClient } = require("mongodb");
const { nanoid } = require("nanoid");

let clientPromise = null;
let indexesPromise = null;

// Some Windows setups fail to resolve MongoDB Atlas's SRV DNS records even
// after the OS-level DNS is changed, because Node keeps using its own
// resolver. Forcing Google's DNS here fixes that without touching the OS.
// Only override DNS locally (some Windows setups fail to resolve Atlas's
// SRV records). Vercel's own network already resolves this correctly, and
// forcing an external DNS server there can make connections hang.
if (process.env.NODE_ENV !== "production") {
  try {
    const dns = require("dns");
    dns.setServers(["8.8.8.8", "8.8.4.4"]);
  } catch (err) {
    /* ignore if not supported */
  }
}

// Reuse one connection across warm serverless invocations instead of
// reconnecting on every request.

function getClient() {
  if (!clientPromise) {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is not set. Add it in Vercel > Project > Settings > Environment Variables."
      );
    }
    const client = new MongoClient(process.env.MONGODB_URI, {
      tls: true,
      serverSelectionTimeoutMS: 10000,
    });
    clientPromise = client.connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

async function getDb() {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || "menu_app");
}

function warmIndexes(database) {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      database.collection("sections").createIndex({ order: 1 }),
      database.collection("subsections").createIndex({ section_id: 1, order: 1 }),
      database.collection("items").createIndex({ subsection_id: 1, visibility: 1, order: 1 }),
      database.collection("items").createIndex({ visibility: 1, scheduled_publish_at: 1 }),
    ]).catch((error) => {
      indexesPromise = null;
      console.error("Database index warm-up failed:", error);
    });
  }
}

const col = (name) =>
  getDb().then((database) => {
    warmIndexes(database);
    return database.collection(name);
  });

const byOrder = (a, b) => a.order - b.order;
const publicItemFilter = {
  $or: [{ visibility: "public" }, { visibility: { $exists: false } }],
};

// Convert a Mongo doc (_id) into the shape the API/frontend expects (id).
function toPublic(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

// Swap the `order` field of `id` with its neighbour in `direction` (-1 up, +1 down)
// among `siblings` (docs already scoped to the same parent).
async function reorder(collection, siblings, id, direction) {
  const sorted = siblings.slice().sort(byOrder);
  const idx = sorted.findIndex((x) => x._id === id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
  const a = sorted[idx];
  const b = sorted[swapIdx];
  await collection.updateOne({ _id: a._id }, { $set: { order: b.order } });
  await collection.updateOne({ _id: b._id }, { $set: { order: a.order } });
}

module.exports = {
  // ---------- sections ----------
  async listSections() {
    const c = await col("sections");
    return (await c.find().sort({ order: 1 }).toArray()).map(toPublic);
  },
  async getSection(id) {
    const c = await col("sections");
    return toPublic(await c.findOne({ _id: id }));
  },
  async createSection(title) {
    const c = await col("sections");
    const last = await c.find().sort({ order: -1 }).limit(1).next();
    const row = { _id: nanoid(), title, order: last ? last.order + 1 : 0 };
    await c.insertOne(row);
    return toPublic(row);
  },
  async updateSection(id, title) {
    const c = await col("sections");
    const res = await c.findOneAndUpdate(
      { _id: id },
      { $set: { title } },
      { returnDocument: "after" }
    );
    return toPublic(res?.value || res);
  },
  async deleteSection(id) {
    const sections = await col("sections");
    const subsections = await col("subsections");
    const items = await col("items");
    const childSubs = (await subsections.find({ section_id: id }).toArray()).map((s) => s._id);
    await items.deleteMany({ subsection_id: { $in: childSubs } });
    await subsections.deleteMany({ section_id: id });
    await sections.deleteOne({ _id: id });
  },
  async reorderSection(id, direction) {
    const c = await col("sections");
    const all = await c.find().toArray();
    await reorder(c, all, id, direction);
  },

  // ---------- subsections ----------
  async listSubsections(sectionId) {
    const c = await col("subsections");
    return (await c.find({ section_id: sectionId }).sort({ order: 1 }).toArray()).map(toPublic);
  },
  async getSubsection(id) {
    const c = await col("subsections");
    return toPublic(await c.findOne({ _id: id }));
  },
  async createSubsection(sectionId, title) {
    const c = await col("subsections");
    const last = await c.find({ section_id: sectionId }).sort({ order: -1 }).limit(1).next();
    const row = { _id: nanoid(), section_id: sectionId, title, order: last ? last.order + 1 : 0 };
    await c.insertOne(row);
    return toPublic(row);
  },
  async updateSubsection(id, title) {
    const c = await col("subsections");
    const res = await c.findOneAndUpdate(
      { _id: id },
      { $set: { title } },
      { returnDocument: "after" }
    );
    return toPublic(res?.value || res);
  },
  async deleteSubsection(id) {
    const subsections = await col("subsections");
    const items = await col("items");
    await items.deleteMany({ subsection_id: id });
    await subsections.deleteOne({ _id: id });
  },
  async reorderSubsection(id, direction) {
    const c = await col("subsections");
    const row = await c.findOne({ _id: id });
    if (!row) return;
    const siblings = await c.find({ section_id: row.section_id }).toArray();
    await reorder(c, siblings, id, direction);
  },

  // ---------- items ----------
  async listItems(subsectionId, { includePrivate = false } = {}) {
    const c = await col("items");
    const filter = includePrivate
      ? { subsection_id: subsectionId }
      : { subsection_id: subsectionId, ...publicItemFilter };
    return (await c.find(filter).sort({ order: 1 }).toArray()).map(toPublic);
  },
  async getItem(id, { includePrivate = false } = {}) {
    const c = await col("items");
    const filter = includePrivate ? { _id: id } : { _id: id, ...publicItemFilter };
    return toPublic(await c.findOne(filter));
  },
  async createItem(subsectionId, fields) {
    const c = await col("items");
    const last = await c.find({ subsection_id: subsectionId }).sort({ order: -1 }).limit(1).next();
    const row = {
      _id: nanoid(),
      subsection_id: subsectionId,
      order: last ? last.order + 1 : 0,
      ...fields,
    };
    await c.insertOne(row);
    return toPublic(row);
  },
  async updateItem(id, fields) {
    const c = await col("items");
    const res = await c.findOneAndUpdate({ _id: id }, { $set: fields }, { returnDocument: "after" });
    return toPublic(res?.value || res);
  },
  async setItemVisibility(id, visibility) {
    const c = await col("items");
    const update = {
      $set: { visibility, visibility_updated_at: new Date() },
      $unset: { scheduled_publish_at: "" },
    };
    const res = await c.findOneAndUpdate(
      { _id: id },
      update,
      { returnDocument: "after" }
    );
    return toPublic(res?.value || res);
  },
  async scheduleItem(id, publishAt) {
    const c = await col("items");
    const update = publishAt
      ? {
          $set: {
            visibility: "private",
            scheduled_publish_at: publishAt,
            visibility_updated_at: new Date(),
          },
        }
      : {
          $set: { visibility: "private", visibility_updated_at: new Date() },
          $unset: { scheduled_publish_at: "" },
        };
    const res = await c.findOneAndUpdate(
      { _id: id },
      update,
      { returnDocument: "after" }
    );
    return toPublic(res?.value || res);
  },
  async publishDueItems(now = new Date()) {
    const c = await col("items");
    const due = await c
      .find({
        visibility: "private",
        scheduled_publish_at: { $lte: now },
      })
      .limit(50)
      .toArray();
    const published = [];

    for (const item of due) {
      const res = await c.findOneAndUpdate(
        {
          _id: item._id,
          visibility: "private",
          scheduled_publish_at: { $lte: now },
        },
        {
          $set: {
            visibility: "public",
            scheduled_published_at: now,
            visibility_updated_at: now,
          },
          $unset: { scheduled_publish_at: "" },
        },
        { returnDocument: "after" }
      );
      const updated = res?.value || res;
      if (updated) published.push(toPublic(updated));
    }

    return published;
  },
  async deleteItem(id) {
    const c = await col("items");
    const row = await c.findOne({ _id: id });
    await c.deleteOne({ _id: id });
    return toPublic(row);
  },
  async reorderItem(id, direction) {
    const c = await col("items");
    const row = await c.findOne({ _id: id });
    if (!row) return;
    const siblings = await c.find({ subsection_id: row.subsection_id }).toArray();
    await reorder(c, siblings, id, direction);
  },

  // ---------- update subscribers ----------
  async subscribe(email) {
    const c = await col("subscribers");
    await c.createIndex({ email: 1 }, { unique: true });
    const now = new Date();
    const result = await c.updateOne(
      { email },
      {
        $set: { active: true, updated_at: now },
        $setOnInsert: {
          _id: nanoid(),
          unsubscribe_token: nanoid(32),
          created_at: now,
        },
      },
      { upsert: true }
    );
    return { alreadySubscribed: result.upsertedCount === 0 };
  },
  async listActiveSubscribers() {
    const c = await col("subscribers");
    return c
      .find(
        { active: true },
        { projection: { email: 1, unsubscribe_token: 1 } }
      )
      .toArray();
  },
  async unsubscribe(token) {
    const c = await col("subscribers");
    const result = await c.updateOne(
      { unsubscribe_token: token, active: true },
      { $set: { active: false, updated_at: new Date() } }
    );
    return result.modifiedCount > 0;
  },
};
