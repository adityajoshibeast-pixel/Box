const { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const BUCKET = process.env.B2_BUCKET_NAME;

const client = new S3Client({
  region: process.env.B2_REGION || "us-west-004",
  endpoint: process.env.B2_ENDPOINT, // e.g. https://s3.us-west-004.backblazeb2.com
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
});

// Returns a short-lived URL the browser can PUT the file to directly.
async function getPresignedUploadUrl(key, contentType) {
  if (!process.env.B2_ENDPOINT || !BUCKET) {
    throw new Error("Backblaze B2 is not configured (missing B2_* env vars)");
  }
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 }); // 5 minutes
  return { uploadUrl };
}

// The bucket stays PRIVATE (no payment-history requirement that way), so
// reading a file back also needs a short-lived signed URL, generated fresh
// on each request rather than stored permanently.
async function getPresignedDownloadUrl(key, { download, filename } = {}) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(download
      ? { ResponseContentDisposition: `attachment; filename="${filename || key}"` }
      : {}),
  });
  return getSignedUrl(client, command, { expiresIn: 3600 }); // 1 hour
}

async function deleteB2File(key) {
  if (!key || !BUCKET) return;
  try {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error("B2 delete failed:", err.message);
  }
}

module.exports = { getPresignedUploadUrl, getPresignedDownloadUrl, deleteB2File };
