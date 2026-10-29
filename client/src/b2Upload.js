import { api } from "./api.js";

// Uploads a large file straight from the browser to Backblaze B2, bypassing
// the serverless function entirely so there's no request-size limit.
export function uploadToB2(file, onProgress) {
  return new Promise((resolve, reject) => {
    const contentType = file.type || "application/octet-stream";
    api.getB2UploadUrl(file.name, contentType)
      .then(({ uploadUrl, key }) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", contentType);

        if (xhr.upload && typeof onProgress === "function") {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && e.total > 0) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent, e.loaded, e.total);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ key });
          } else {
            reject(new Error(`B2 upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error("B2 upload network error"));
        };

        xhr.ontimeout = () => {
          reject(new Error("B2 upload timed out"));
        };

        xhr.send(file);
      })
      .catch(reject);
  });
}
