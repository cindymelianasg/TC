/**
 * Compress an image File to a reasonable size before upload.
 * Returns a Blob (with mimetype) suitable for posting as the same field name.
 * Skips compression for non-images and very small images.
 */
export async function compressImage(file, { maxSize = 1600, quality = 0.82, maxBytes = 600 * 1024 } = {}) {
  if (!file || !file.type?.startsWith("image/")) return file;
  if (file.size <= maxBytes) return file;
  if (file.type === "image/gif") return file; // preserve animations

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  let { width, height } = img;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const outType = file.type === "image/png" ? "image/jpeg" : file.type;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, outType, quality));
  if (!blob) return file;
  // Wrap blob with filename for FormData
  return new File([blob], file.name.replace(/\.png$/i, ".jpg"), { type: outType });
}
