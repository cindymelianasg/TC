import { Component } from "react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";

/**
 * Top-level error boundary with friendly user-facing message.
 * Catches all unhandled render errors and displays Refresh/Logout actions.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorCode: "ERR-000" };
  }

  static getDerivedStateFromError(error) {
    const code = error?.name === "ChunkLoadError" ? "ERR-002"
      : error?.message?.includes("NetworkError") ? "ERR-003"
      : "ERR-001";
    return { hasError: true, errorCode: code, message: error?.message || "" };
  }

  componentDidCatch(error, info) {
    console.error("[SMART-TC] Caught error:", error, info);
  }

  handleRefresh = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  handleLogout = () => {
    localStorage.removeItem("spcs_token");
    localStorage.removeItem("spcs_user");
    window.location.assign("/login");
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 max-w-md w-full text-center" data-testid="error-boundary">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Terjadi gangguan sistem</h2>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            Silakan coba <strong>Refresh halaman</strong>. Jika masalah masih berlanjut, <strong>logout lalu login kembali</strong>. Pastikan koneksi internet stabil.
          </p>
          <div className="mt-4 inline-block bg-slate-100 px-3 py-1 rounded-md text-xs font-mono text-slate-700">
            Kode error: {this.state.errorCode}
          </div>
          <div className="flex items-center gap-2 mt-6">
            <button onClick={this.handleRefresh} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" data-testid="error-refresh">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={this.handleLogout} className="flex-1 border border-slate-300 hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" data-testid="error-logout">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </div>
    );
  }
}
