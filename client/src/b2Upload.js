import { api } from "./api.js";

// Uploads a large file straight from the browser to Backblaze B2, bypassing
// the serverless function entirely so there's no request-size limit.
export async function uploadToB2(file) {
  const { uploadUrl, key } = await api.getB2UploadUrl(file.name, file.type);

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error("B2 upload failed");
  }
  return { key };
}
