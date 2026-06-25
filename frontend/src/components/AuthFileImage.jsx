import { useEffect, useState } from "react";
import { API } from "@/lib/api";

/**
 * Auth-protected file image. Fetches via auth header (blob) for security,
 * then renders an <img> with a blob URL.
 */
export default function AuthFileImage({ fileId, className, alt = "image", fallback = null }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revokeUrl = null;
    let cancelled = false;
    async function load() {
      if (!fileId) return;
      try {
        const token = localStorage.getItem("spcs_token");
        const res = await fetch(`${API}/files/${fileId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Gagal memuat file");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        revokeUrl = blobUrl;
        if (!cancelled) setUrl(blobUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    return () => {
      cancelled = true;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [fileId]);

  if (!fileId) return fallback;
  if (error) return fallback || <div className={`bg-slate-100 text-slate-400 flex items-center justify-center text-xs ${className}`}>Gagal memuat</div>;
  if (!url) return <div className={`bg-slate-100 animate-pulse ${className}`} />;
  return <img src={url} alt={alt} className={className} />;
}
