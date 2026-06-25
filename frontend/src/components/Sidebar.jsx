import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Database, FileBarChart, Users, Settings, LogOut, Cog } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
  { to: "/area", label: "Line / Area", icon: Database, testId: "nav-area" },
  { to: "/reports", label: "Laporan Bulanan", icon: FileBarChart, testId: "nav-reports" },
  { to: "/users", label: "User Management", icon: Users, testId: "nav-users" },
  { to: "/settings", label: "Setting", icon: Settings, testId: "nav-settings" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <aside className="hidden lg:flex w-64 flex-shrink-0 bg-slate-900 text-slate-200 flex-col h-screen sticky top-0" data-testid="sidebar">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Cog className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Spare Part</div>
            <div className="text-sm font-semibold text-white leading-tight">Control System</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-testid={item.testId}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate" data-testid="sidebar-user-name">{user?.name}</div>
            <div className="text-xs text-slate-400 truncate">NIK {user?.nik}</div>
          </div>
          <button
            type="button"
            onClick={async () => { await logout(); nav("/login"); }}
            data-testid="logout-btn"
            className="p-2 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
