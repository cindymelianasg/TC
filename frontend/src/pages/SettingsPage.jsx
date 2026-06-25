import { useState } from "react";
import { KeyRound, User, Mail, IdCard } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("Password baru tidak cocok");
      return;
    }
    if (next.length < 4) {
      toast.error("Password baru minimal 4 karakter");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      toast.success("Password berhasil diubah");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal mengubah password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mb-5 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Setting</h1>
        <p className="text-sm text-slate-500">Profil dan keamanan akun.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm" data-testid="profile-card">
          <div className="text-sm font-semibold text-slate-700 mb-4">Profil</div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">{user?.name?.charAt(0)}</div>
            <div>
              <div className="text-lg font-bold text-slate-900">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.rank} • {user?.area}</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <Row icon={IdCard} label="NIK" value={user?.nik} />
            <Row icon={Mail} label="Email" value={user?.email} />
            <Row icon={User} label="Role" value={user?.role === "creator" ? "Creator / Super Admin" : "User"} />
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm" data-testid="password-card">
          <div className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-600" /> Ganti Password
          </div>
          <div className="space-y-3">
            <Input label="Password Saat Ini" type="password" value={current} onChange={setCurrent} testId="pwd-current" />
            <Input label="Password Baru" type="password" value={next} onChange={setNext} testId="pwd-new" />
            <Input label="Konfirmasi Password Baru" type="password" value={confirm} onChange={setConfirm} testId="pwd-confirm" />
            <button type="submit" disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60" data-testid="pwd-submit">
              {busy ? "Memproses..." : "Ubah Password"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
      <Icon className="w-4 h-4 text-slate-400" />
      <div className="text-xs text-slate-500 w-16">{label}</div>
      <div className="text-sm text-slate-800 font-medium">{value}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", testId }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required data-testid={testId}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
  );
}
