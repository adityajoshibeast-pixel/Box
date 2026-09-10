const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ADMIN_PASSWORD = "test-password";
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

const db = require("./db");

db.publishDueItems = async () => [];
db.listItems = async (_subsectionId, options = {}) =>
  options.includePrivate
    ? [{ id: "public-file" }, { id: "private-file", visibility: "private" }]
    : [{ id: "public-file" }];
db.getItem = async (_id, options = {}) =>
  options.includePrivate
    ? { id: "private-file", type: "pdf", visibility: "private" }
    : null;

let scheduledAt;
db.scheduleItem = async (id, publishAt) => {
  scheduledAt = publishAt;
  return { id, visibility: "private", scheduled_publish_at: publishAt };
};

const app = require("./app");

test("public feed never exposes private files, including with an admin cookie", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const login = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "test-password" }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];

  const publicResponse = await fetch(`${base}/api/subsections/sub-1/items`, {
    headers: { cookie },
  });
  assert.deepEqual(await publicResponse.json(), [{ id: "public-file" }]);

  const privateItemResponse = await fetch(`${base}/api/items/private-file`, {
    headers: { cookie },
  });
  assert.equal(privateItemResponse.status, 404);

  const privateDownloadResponse = await fetch(`${base}/api/items/private-file/download`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(privateDownloadResponse.status, 404);

  const adminResponse = await fetch(`${base}/api/admin/subsections/sub-1/items`, {
    headers: { cookie },
  });
  assert.deepEqual(await adminResponse.json(), [
    { id: "public-file" },
    { id: "private-file", visibility: "private" },
  ]);
});

test("admin can schedule a file for one minute", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const login = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "test-password" }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const before = Date.now();

  const response = await fetch(`${base}/api/admin/items/private-file/schedule`, {
    method: "PUT",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ minutes: 1 }),
  });

  assert.equal(response.status, 200);
  assert.ok(scheduledAt instanceof Date);
  assert.ok(scheduledAt.getTime() - before >= 59_000);
  assert.ok(scheduledAt.getTime() - before <= 61_000);
});
