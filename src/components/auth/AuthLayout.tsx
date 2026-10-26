import { CloudSun, ShieldCheck, SunMedium, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink-950 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-energy-500/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-40 -left-20 size-[26rem] rounded-full bg-info-500/10 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <Link to="/login" className="inline-flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-energy-500/15 ring-1 ring-inset ring-energy-500/30">
              <SunMedium className="size-4.5 text-energy-500" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[-0.01em] text-white">SolarGrid Exchange</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Peer-to-peer solar marketplace</p>
            </div>
          </Link>

          <h2 className="mt-14 max-w-md text-[34px] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
            Trade the sunshine your roof leaves behind.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
            A working solar microgrid simulation with real weather from Open-Meteo, household demand, dynamic pricing
            and accountable peer-to-peer energy offers.
          </p>

          <div className="mt-10 grid max-w-md gap-3">
            {[
              { icon: SunMedium, title: "Sell your estimated surplus", copy: "Create offers from your own rooftop forecast." },
              { icon: Zap, title: "Buy local energy", copy: "Compare live offers and purchase simulated kWh." },
              { icon: ShieldCheck, title: "Private by design", copy: "Role-based accounts keep offers, sales and purchases separate." },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-energy-500">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[12.5px] font-medium text-slate-100">{item.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-5 text-slate-500">{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-3 text-[11px] text-slate-500">
          <CloudSun className="size-4 text-slate-600" aria-hidden="true" />
          <span>Weather via MCP · generation and trades are simulated · no financial settlement</span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-xl bg-ink-900">
              <SunMedium className="size-4.5 text-energy-500" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">SolarGrid Exchange</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">P2P solar marketplace</p>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
            <p className="label-xs">Secure account access</p>
            <h1 className="mt-2 text-[26px] font-semibold leading-8 tracking-[-0.025em] text-ink-900">{title}</h1>
            <p className="mt-2 text-[13px] leading-6 text-slate-500">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          <div className="mt-5 text-center text-xs text-slate-500">{footer}</div>
        </div>
      </section>
    </div>
  );
}
