import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Cog, Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function LoginPage() {
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/area";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(nik.trim(), password);
      toast.success("Login berhasil");
      navigate(from, { replace: true });
    } catch (err) {
      const msg = formatApiError(err.response?.data?.detail) || "Gagal login";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen login-hero flex items-center justify-center p-4" data-testid="login-page">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 animate-fade-up" data-testid="login-card">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-lg">
            <Cog className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">SPARE PART</h1>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500 font-semibold mt-1">Control System</div>
          <p className="text-sm text-slate-500 mt-4">Login menggunakan NIK karyawan</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              NIK <span className="lowercase tracking-normal text-slate-400">(Nomor Induk Karyawan)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              placeholder="Masukkan NIK"
              required
              data-testid="login-nik-input"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                required
                data-testid="login-password-input"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" data-testid="login-toggle-password">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            data-testid="login-submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {busy ? "Memproses..." : "LOGIN"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Suzuki — Maintenance Tracking
        </div>
      </div>
    </div>
  );
}
