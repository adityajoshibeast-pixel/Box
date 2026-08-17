const { del } = require("@vercel/blob");

async function deleteFile(url) {
  if (!url) return;
  try {
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (err) {
    console.error("Blob delete failed:", err.message);
  }
}

module.exports = { deleteFile };