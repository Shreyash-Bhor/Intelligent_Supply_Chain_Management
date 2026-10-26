import Link from "next/link";
import { ArrowRight, Boxes, ChartNoAxesCombined, CircleAlert, PackageCheck, Warehouse } from "lucide-react";

const dashboardViews = [
  { icon: Boxes, title: "Inventory health", detail: "Stock levels and SKU risk", status: "Live" },
  { icon: Warehouse, title: "Warehouse capacity", detail: "Utilization across locations", status: "Network" },
  { icon: PackageCheck, title: "Reorder control", detail: "Prioritize replenishment", status: "Actionable" },
];

export function ManagerDashboardFeature() {
  return (
    <section aria-labelledby="manager-dashboard-title" className="mx-auto max-w-7xl px-5 pb-12 sm:px-8 lg:px-12">
      <div className="manager-feature landing-reveal grid gap-8 overflow-hidden rounded-[1.75rem] border border-white/15 p-6 text-white shadow-[0_28px_70px_-36px_rgba(18,38,25,.8)] sm:p-9 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:p-11">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-secondary/65 bg-secondary/15 px-3 py-1.5 text-xs font-semibold text-secondary"><ChartNoAxesCombined className="size-3.5"/> For warehouse managers</span>
          <h2 id="manager-dashboard-title" className="mt-5 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">A powerful admin dashboard for your entire warehouse network.</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/75 sm:text-base">See stock health, warehouse capacity, at-risk products, and reorder activity in one control tower. Move from a network-wide signal to the next operational action.</p>
          <Link href="/login/manager" className="mt-7 inline-flex h-11 items-center gap-2 rounded-lg bg-secondary px-4 text-sm font-semibold text-secondary-foreground shadow-lg shadow-black/15 transition-all hover:-translate-y-0.5 hover:shadow-xl">Explore manager dashboard <ArrowRight className="size-4"/></Link>
        </div>

        <div className="manager-feature-panel relative rounded-2xl border border-white/20 bg-black/15 p-4 shadow-inner backdrop-blur-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between border-b border-white/15 pb-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Warehouse className="size-5"/></span><div><p className="text-sm font-semibold">Manager control tower</p><p className="text-xs text-white/65">Admin dashboard preview</p></div></div><span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/40 bg-secondary/10 px-2.5 py-1 text-[10px] font-medium text-secondary"><span className="size-1.5 rounded-full bg-secondary"/> Network view</span></div>
          <div className="space-y-2.5">{dashboardViews.map(({ icon: Icon, title, detail, status }, index) => <div key={title} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[.07] p-3 transition-colors hover:bg-white/[.12] sm:p-3.5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-secondary"><Icon className="size-4"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span><span className="mt-0.5 block truncate text-xs text-white/60">{detail}</span></span><span className={`hidden items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium sm:inline-flex ${index === 1 ? "bg-secondary/15 text-secondary" : "bg-white/10 text-white/75"}`}>{index === 2 && <CircleAlert className="size-3"/>}{status}</span></div>)}</div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-secondary/45 bg-secondary/10 px-3 py-2.5 text-xs text-white/80"><CircleAlert className="size-4 shrink-0 text-secondary"/><span>Surface low stock early and keep replenishment moving.</span></div>
        </div>
      </div>
    </section>
  );
}
