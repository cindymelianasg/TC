import { useRef, useState } from "react";
import { UploadCloud, X, FileText, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "sonner";

/**
 * Multi-file uploader with image compression and progress indicator.
 */
export default function FileUploader({
  value,
  onChange,
  accept = "image/*,application/pdf",
  single = false,
  label = "Upload File",
  testId,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const files = single ? (value ? [value] : []) : (Array.isArray(value) ? value : []);

  const handleUpload = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length) return;
    setUploading(true);
    setProgress(0);
    try {
      const uploaded = [];
      for (let i = 0; i < fileList.length; i += 1) {
        let f = fileList[i];
        // Auto-compress images > 600KB
        if (f.type?.startsWith("image/")) {
          try { f = await compressImage(f); } catch { /* keep original */ }
        }
        const fd = new FormData();
        fd.append("file", f);
        const { data } = await api.post("/files/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (evt) => {
            if (!evt.total) return;
            const pct = Math.round(((i + evt.loaded / evt.total) / fileList.length) * 100);
            setProgress(pct);
          },
        });
        uploaded.push(data);
      }
      if (single) {
        onChange(uploaded[0]);
      } else {
        onChange([...(files || []), ...uploaded]);
      }
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal upload file");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (idx) => {
    if (single) onChange(null);
    else onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div data-testid={testId}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || disabled}
        className="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 hover:border-blue-400 transition-colors cursor-pointer flex flex-col items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        data-testid={testId ? `${testId}-trigger` : undefined}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        ) : (
          <UploadCloud className="w-6 h-6 text-blue-600" />
        )}
        <div className="text-sm font-medium text-slate-700">{uploading ? `Mengupload... ${progress}%` : label}</div>
        <div className="text-xs text-slate-400">JPG, PNG, PDF (auto-compressed, max 10MB)</div>
        {uploading && (
          <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </button>
      <input ref={inputRef} type="file" multiple={!single} accept={accept} onChange={handleUpload} className="hidden" />
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li key={f.id || i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200" data-testid={testId ? `${testId}-item-${i}` : undefined}>
              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-sm text-slate-700 truncate flex-1">{f.filename}</span>
              <button type="button" onClick={() => removeAt(i)} className="p-1 text-slate-500 hover:text-red-600" data-testid={testId ? `${testId}-remove-${i}` : undefined}>
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
