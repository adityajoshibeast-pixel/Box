const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();

const { list, del } = require("@vercel/blob");
const { MongoClient } = require("mongodb");
const { nanoid } = require("nanoid");
const { uploadB2Buffer } = require("../server/b2");

async function migrate() {
  console.log("=== Starting Vercel Blob -> Backblaze B2 Migration ===");

  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!process.env.B2_ENDPOINT || !process.env.B2_BUCKET_NAME) {
    console.error("Missing B2 environment variables");
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Missing BLOB_READ_WRITE_TOKEN");
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI, { tls: true });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "menu_app");
  const itemsCollection = db.collection("items");

  // 1. Find all items referencing Vercel Blob
  const blobItems = await itemsCollection
    .find({
      $or: [
        { provider: "blob" },
        { file_url: { $regex: "blob\\.vercel-storage\\.com" } },
      ],
    })
    .toArray();

  console.log(`Found ${blobItems.length} items in MongoDB referencing Vercel Blob.`);

  let migratedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < blobItems.length; i++) {
    const item = blobItems[i];
    const indexStr = `[${i + 1}/${blobItems.length}]`;
    console.log(`\n${indexStr} Migrating item "${item.title}" (ID: ${item._id})...`);
    console.log(`   Source URL: ${item.file_url}`);

    try {
      // Step A: Download from Vercel Blob
      const res = await fetch(item.file_url);
      if (!res.ok) {
        throw new Error(`Failed to download from Blob (HTTP ${res.status} ${res.statusText})`);
      }
      const arrayBuf = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const contentType = res.headers.get("content-type") || (item.type === "pdf" ? "application/pdf" : "image/jpeg");
      console.log(`   Downloaded ${buffer.length} bytes (type: ${contentType})`);

      // Step B: Generate B2 key
      const originalName = item.original_name || item.title || "file.pdf";
      const sanitizedName = originalName.replace(/\s+/g, "_");
      const key = `${nanoid()}-${sanitizedName}`;

      // Step C: Upload to Backblaze B2
      console.log(`   Uploading to Backblaze B2 (key: ${key})...`);
      await uploadB2Buffer(key, buffer, contentType);
      console.log(`   Uploaded to Backblaze B2 successfully.`);

      // Step D: Update MongoDB document
      console.log(`   Updating MongoDB record...`);
      await itemsCollection.updateOne(
        { _id: item._id },
        {
          $set: {
            provider: "b2",
            key: key,
            original_name: originalName,
          },
          $unset: {
            file_url: "",
            download_url: "",
          },
        }
      );
      console.log(`   MongoDB updated successfully!`);

      // Step E: Delete from Vercel Blob (only after B2 upload & DB update succeed)
      console.log(`   Deleting from Vercel Blob: ${item.file_url}`);
      await del(item.file_url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      console.log(`   Deleted from Vercel Blob successfully.`);

      migratedCount++;
    } catch (err) {
      console.error(`   ERROR migrating item ${item._id}:`, err.message);
      failedCount++;
    }
  }

  console.log(`\n=== MongoDB Items Migration Complete ===`);
  console.log(`Successfully migrated: ${migratedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.warn(`\n⚠️ Note: ${failedCount} items could not be downloaded from Vercel Blob.`);
    console.warn("If Vercel Blob returns '403 Forbidden: Your store is blocked', Vercel has suspended public access due to plan limits.");
    console.warn("Once unblocked in Vercel dashboard or if you have local backup files, re-run this script to complete migration.");
  }

  try {
    const listRes = await list({ token: process.env.BLOB_READ_WRITE_TOKEN });
    console.log(`\nRemaining blobs in Vercel Blob store: ${listRes.blobs.length}`);
  } catch (err) {
    console.error("Error checking Vercel Blob count:", err.message);
  }

  await client.close();
  console.log("\nMigration completed successfully.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
