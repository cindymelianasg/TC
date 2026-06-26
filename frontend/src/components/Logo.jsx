import { Cog } from "lucide-react";

/**
 * SMART-TC official wordmark/logo. Used in sidebar, login, and exports.
 */
export default function Logo({ size = "md", showSubtitle = false, light = false }) {
  const sizes = {
    sm: { wrap: "gap-2", icon: "w-7 h-7", title: "text-sm", subtitle: "text-[10px]" },
    md: { wrap: "gap-3", icon: "w-10 h-10", title: "text-base", subtitle: "text-xs" },
    lg: { wrap: "gap-3", icon: "w-14 h-14", title: "text-2xl", subtitle: "text-xs" },
  };
  const s = sizes[size] || sizes.md;
  return (
    <div className={`flex items-center ${s.wrap}`} data-testid="logo">
      <div className={`${s.icon} rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md relative overflow-hidden`}>
        <Cog className={`text-white ${size === "lg" ? "w-7 h-7" : size === "sm" ? "w-4 h-4" : "w-5 h-5"}`} />
        <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 border border-white" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`${s.title} font-extrabold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
          SMART<span className={light ? "text-blue-300" : "text-blue-600"}>-TC</span>
        </span>
        {showSubtitle && (
          <span className={`${s.subtitle} uppercase tracking-[0.18em] ${light ? "text-slate-300" : "text-slate-500"}`}>
            TC Body Maintenance
          </span>
        )}
      </div>
    </div>
  );
}
