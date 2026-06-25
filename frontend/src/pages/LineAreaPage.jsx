import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { LINE_AREAS } from "@/constants/lines";

export default function LineAreaPage() {
  const nav = useNavigate();
  return (
    <AppShell>
      <div className="mb-6 animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Line / Area</h1>
        <p className="text-slate-500 mt-1">Pilih line / area untuk melihat data spare part.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {LINE_AREAS.map((line, idx) => {
          const Icon = line.icon;
          return (
            <button
              key={line.key}
              onClick={() => nav(`/line/${line.slug}`)}
              data-testid={`line-card-${line.slug}`}
              className={`group relative bg-white rounded-2xl border border-slate-200 p-6 text-left hover:shadow-lg hover:border-blue-300 hover:-translate-y-0.5 transition-all animate-fade-up delay-${(idx % 4) + 1}`}
            >
              <div className={`w-16 h-16 rounded-xl ${line.bg} flex items-center justify-center mb-4`}>
                <Icon className={`w-8 h-8 ${line.color}`} />
              </div>
              <div className="text-lg font-bold text-slate-900 tracking-tight">{line.key}</div>
              <div className="text-sm text-slate-500 mt-1">{line.label}</div>
              <div className="absolute top-5 right-5 text-xs text-slate-400 group-hover:text-blue-600 transition-colors">
                →
              </div>
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}
