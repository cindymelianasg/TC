import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50" data-testid="app-shell">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" data-testid="main-content">
        <div className="max-w-[1500px] mx-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
