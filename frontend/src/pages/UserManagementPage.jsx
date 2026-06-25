import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, KeyRound, Info } from "lucide-react";
import AppShell from "@/components/AppShell";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { RANK_OPTIONS } from "@/constants/lines";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function UserManagementPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const isCreator = user?.role === "creator";

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => { setEditingUser(null); setDialogOpen(true); };
  const openEdit = (u) => { setEditingUser(u); setDialogOpen(true); };

  const handleDelete = async (u) => {
    if (!window.confirm(`Hapus user ${u.name}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("User dihapus");
      fetchUsers();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal menghapus");
    }
  };

  const handleReset = async (u) => {
    if (!window.confirm(`Reset password ${u.name} ke default (123456)?`)) return;
    try {
      const { data } = await api.post(`/users/${u.id}/reset-password`);
      toast.success(`Password direset ke: ${data.default_password}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal reset");
    }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3 mb-5 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500">Daftar pengguna sistem.</p>
        </div>
        {isCreator && (
          <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" data-testid="user-add-btn">
            <Plus className="w-4 h-4" /> Tambah User
          </button>
        )}
      </div>

      {!isCreator && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800" data-testid="user-readonly-notice">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div>Hanya <strong>CINDY MELIANA SARI GUNAWAN</strong> (Creator) yang dapat menambah, mengubah, atau menghapus user. Anda hanya dapat melihat daftar.</div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm" data-testid="user-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">No</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">NIK</th>
                <th className="px-4 py-3 text-left font-medium">Rank</th>
                <th className="px-4 py-3 text-left font-medium">Area</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                {isCreator && <th className="px-4 py-3 text-right font-medium">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-10 text-slate-400">Memuat...</td></tr>}
              {!loading && users.map((u, i) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`user-row-${i}`}>
                  <td className="px-4 py-3 text-slate-700">{i + 1}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-slate-700">{u.email}</td>
                  <td className="px-4 py-3 text-slate-700 font-mono text-xs">{u.nik}</td>
                  <td className="px-4 py-3 text-slate-700">{u.rank}</td>
                  <td className="px-4 py-3 text-slate-700">{u.area}</td>
                  <td className="px-4 py-3">
                    {u.role === "creator" ? (
                      <span className="status-pill bg-blue-100 text-blue-700 border-blue-200">CREATOR</span>
                    ) : (
                      <span className="status-pill bg-slate-100 text-slate-700 border-slate-200">USER</span>
                    )}
                  </td>
                  {isCreator && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleReset(u)} title="Reset Password" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600" data-testid={`user-reset-${i}`}>
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(u)} title="Edit" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600" data-testid={`user-edit-${i}`}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        {u.role !== "creator" && u.id !== user?.id && (
                          <button onClick={() => handleDelete(u)} title="Hapus" className="p-1.5 rounded-md hover:bg-red-50 text-red-600" data-testid={`user-delete-${i}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UserDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        user={editingUser}
        onSaved={() => { setDialogOpen(false); fetchUsers(); }}
      />
    </AppShell>
  );
}

function UserDialog({ open, onClose, user, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState({ name: "", email: "", nik: "", rank: "PELAKSANA", area: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name, email: user.email, nik: user.nik, rank: user.rank, area: user.area });
    else setForm({ name: "", email: "", nik: "", rank: "PELAKSANA", area: "" });
  }, [user, open]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name || !form.email || !form.nik || !form.area) {
      toast.error("Lengkapi semua field");
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        await api.put(`/users/${user.id}`, form);
        toast.success("User diperbarui");
      } else {
        await api.post(`/users`, form);
        toast.success("User dibuat — password default: 123456");
      }
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="user-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Tambah User Baru"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input label="Nama Lengkap" value={form.name} onChange={(v) => update("name", v)} testId="user-form-name" />
          <Input label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} testId="user-form-email" />
          <Input label="NIK" value={form.nik} onChange={(v) => update("nik", v)} testId="user-form-nik" />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Rank</label>
            <select value={form.rank} onChange={(e) => update("rank", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="user-form-rank">
              {RANK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Input label="Area" value={form.area} onChange={(v) => update("area", v)} placeholder="contoh: TC BODY, PRESSING, dst." testId="user-form-area" />
          {!isEdit && (
            <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
              Password default akan di-set ke <code className="font-mono font-semibold">123456</code>.
            </div>
          )}
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">Batal</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold" data-testid="user-form-save">{busy ? "Menyimpan..." : "Simpan"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, testId }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
  );
}
