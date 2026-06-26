import { useRef, useState, useEffect, useCallback } from "react";
import { Clipboard, X, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { compressImage } from "@/lib/imageCompression";
import AuthFileImage from "@/components/AuthFileImage";
import { toast } from "sonner";

/**
 * Paste-only signature/stamp box.
 * User clicks the box (or "Paste Signature" button) to focus it, then presses Ctrl+V.
 * Reads PNG/JPG image from clipboard (Shokuin) → uploads → calls onChange(FileRef).
 * No file upload dialog, no drag/drop.
 */
export default function SignaturePaste({ value, onChange, label = "Paste from Shokuin", testId, hint = "Klik di sini lalu tekan Ctrl+V untuk paste dari Shokuin" }) {
  const boxRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleImageFromClipboard = useCallback(async (clipboardData) => {
    if (!clipboardData) return false;
    const items = Array.from(clipboardData.items || []);
    const imgItem = items.find((it) => it.type?.startsWith("image/"));
    if (!imgItem) return false;
    const blob = imgItem.getAsFile();
    if (!blob) return false;
    setBusy(true);
    try {
      // Wrap blob as File so backend gets a filename
      const ext = blob.type.split("/")[1] || "png";
      const file = new File([blob], `signature-${Date.now()}.${ext}`, { type: blob.type });
      const compressed = await compressImage(file, { maxSize: 1200, maxBytes: 300 * 1024 });
      const fd = new FormData();
      fd.append("file", compressed);
      const { data } = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data);
      toast.success("Tanda tangan berhasil di-paste");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal memproses paste");
    } finally {
      setBusy(false);
    }
    return true;
  }, [onChange]);

  // Local paste handler (works when box is focused)
  const handlePaste = async (e) => {
    e.preventDefault();
    await handleImageFromClipboard(e.clipboardData);
  };

  // Also support paste at document level when this box is focused, in case the
  // browser dispatches the paste to the document instead of the focused div.
  useEffect(() => {
    if (!focused) return undefined;
    const onDocPaste = async (e) => {
      // Only handle if no other input has the focus
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      e.preventDefault();
      await handleImageFromClipboard(e.clipboardData);
    };
    document.addEventListener("paste", onDocPaste);
    return () => document.removeEventListener("paste", onDocPaste);
  }, [focused, handleImageFromClipboard]);

  const focusBox = () => boxRef.current?.focus();

  return (
    <div data-testid={testId}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <div
        ref={boxRef}
        tabIndex={0}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={focusBox}
        className={`relative border-2 border-dashed rounded-xl p-4 min-h-[140px] flex items-center justify-center transition cursor-text outline-none ${
          focused ? "border-blue-500 bg-blue-50/40 ring-2 ring-blue-200" : "border-slate-300 bg-slate-50 hover:border-blue-400"
        }`}
        data-testid={testId ? `${testId}-box` : undefined}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-2 text-blue-600">
            <Loader2 className="w-6 h-6 animate-spin" />
            <div className="text-xs">Memproses paste...</div>
          </div>
        ) : value ? (
          <div className="relative w-full">
            <AuthFileImage fileId={value.id} className="max-h-32 mx-auto object-contain bg-white rounded" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow"
              data-testid={testId ? `${testId}-clear` : undefined}
              title="Hapus"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-center">
            <Clipboard className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
            <div className="text-sm font-medium text-slate-700">{focused ? "Tekan Ctrl + V untuk paste" : hint}</div>
            <div className="text-xs text-slate-400 mt-1">Hanya gambar dari clipboard (Shokuin / dll.)</div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={focusBox}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
        data-testid={testId ? `${testId}-paste-btn` : undefined}
      >
        <Clipboard className="w-3.5 h-3.5" /> Paste Signature
      </button>
    </div>
  );
}
