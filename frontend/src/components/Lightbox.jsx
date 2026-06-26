import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { API } from "@/lib/api";

/**
 * Lightbox for viewing an authenticated image full-size.
 */
export default function Lightbox({ fileId, open, onClose, filename }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!open || !fileId) return undefined;
    let revoke = null;
    let cancelled = false;
    const token = localStorage.getItem("spcs_token");
    fetch(`${API}/files/${fileId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        revoke = URL.createObjectURL(blob);
        setUrl(revoke);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [open, fileId]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={onClose} data-testid="lightbox">
      <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full" data-testid="lightbox-close">
        <X className="w-6 h-6" />
      </button>
      {url ? (
        <img src={url} alt={filename || "preview"} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
      ) : (
        <div className="text-white">Memuat...</div>
      )}
      {filename && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/40 px-3 py-1 rounded-full">{filename}</div>}
    </div>
  );
}
