import { Cog } from "lucide-react";

/**
 * SMART-TC official wordmark/logo.
 * "SMART" navy + "-TC" bright blue. Blue rounded-square icon with white gear.
 */
export default function Logo({ size = "md", showSubtitle = false, light = false }) {
  const sizes = {
    sm: { wrap: "gap-2.5", icon: "w-9 h-9", innerIcon: "w-5 h-5", title: "text-base", subtitle: "text-[10px]" },
    md: { wrap: "gap-3", icon: "w-12 h-12", innerIcon: "w-6 h-6", title: "text-lg", subtitle: "text-xs" },
    lg: { wrap: "gap-3.5", icon: "w-16 h-16", innerIcon: "w-8 h-8", title: "text-3xl", subtitle: "text-xs" },
  };
  const s = sizes[size] || sizes.md;
  const smartCls = light ? "text-white" : "text-blue-950";
  const tcCls = light ? "text-blue-300" : "text-blue-500";
  return (
    <div className={`flex items-center ${s.wrap}`} data-testid="logo">
      <div className={`${s.icon} rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md`}>
        <Cog className={`text-white ${s.innerIcon}`} strokeWidth={2.2} />
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`${s.title} font-extrabold tracking-tight`}>
          <span className={smartCls}>SMART</span><span className={tcCls}>-TC</span>
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
