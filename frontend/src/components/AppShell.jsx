import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50" data-testid="app-shell">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" data-testid="main-content">
        <div className="max-w-[1500px] mx-auto p-6 md:p-8 min-h-full flex flex-col">
          <div className="flex-1">{children}</div>
          <footer className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-between" data-testid="app-footer">
            <div>
              <span className="font-semibold text-slate-600">SMART-TC</span> · Version 1.0
            </div>
            <div>Developed for TC Body Maintenance Division</div>
          </footer>
        </div>
      </main>
    </div>
  );
}
