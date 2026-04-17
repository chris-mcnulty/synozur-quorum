import "./_shared/_group.css";
import { ChevronRight, Plus } from "lucide-react";

export function Login() {
  return (
    <div className="boa min-h-[100dvh] flex flex-col md:flex-row bg-[color:var(--boa-paper)]">
      {/* Brand Panel (Left) */}
      <div 
        className="w-full md:w-[40%] lg:w-[45%] flex flex-col justify-between p-8 md:p-16 border-r boa-rule"
        style={{ 
          background: "linear-gradient(145deg, var(--boa-ink) 0%, var(--boa-aubergine) 150%)", 
          color: "var(--boa-paper)" 
        }}
      >
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <span className="boa-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: "var(--boa-brass)" }}>
              Vol. I
            </span>
            <div className="h-[1px] w-8" style={{ background: "var(--boa-brass-2)" }} />
            <span className="boa-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(245,241,234,0.5)" }}>
              Est. 2026
            </span>
          </div>

          <div>
            <h1 className="boa-display text-5xl md:text-7xl mb-4 tracking-tight">
              Quorum
            </h1>
            <p className="text-[15px] max-w-md leading-relaxed" style={{ color: "rgba(245,241,234,0.7)" }}>
              Sign-in to your council. The boardroom is ready.
            </p>
          </div>
        </div>

        <div className="pt-24">
          <div className="w-12 h-[1px] mb-6" style={{ background: "var(--boa-brass)" }} />
          <p className="boa-display text-lg italic max-w-sm leading-snug" style={{ color: "rgba(245,241,234,0.85)" }}>
            "Quorum (n.) — the minimum number of voices required for a council to act."
          </p>
        </div>
      </div>

      {/* Form Area (Right) */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-16 relative">
        
        {/* SSO footnote at top right */}
        <div className="absolute top-8 right-8 text-right hidden md:block">
          <div className="boa-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "rgba(20,20,26,0.4)" }}>
            Authenticated via Replit
          </div>
          <div className="boa-mono text-[10px] mt-0.5" style={{ color: "var(--boa-ink)" }}>
            emarsh@helixcapital.com
          </div>
        </div>

        <div className="w-full max-w-[440px] flex flex-col">
          <div className="mb-10">
            <h2 className="boa-display text-3xl mb-2 text-[color:var(--boa-ink)]">Select workspace</h2>
            <p className="text-[14px] text-[color:var(--boa-ink-3)]">
              Choose a tenant to continue to your dashboard.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Tenant 1 */}
            <button className="text-left group flex items-center justify-between p-4 boa-surface hover:border-[color:var(--boa-brass)] transition-colors rounded-sm cursor-pointer">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="boa-display text-xl text-[color:var(--boa-ink)] group-hover:text-[color:var(--boa-brass)] transition-colors">
                    Helix Capital
                  </span>
                  <span className="boa-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border border-[color:var(--boa-paper-3)] bg-[color:var(--boa-paper-2)] text-[color:var(--boa-ink)]">
                    Owner
                  </span>
                </div>
                <div className="flex items-center gap-3 boa-mono text-[10px] text-[color:var(--boa-ink-3)] opacity-70">
                  <span className="boa-num">12 MEMBERS</span>
                  <span>·</span>
                  <span>LAST VISITED 2H AGO</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[color:var(--boa-paper-3)] group-hover:text-[color:var(--boa-brass)] transition-colors" />
            </button>

            {/* Tenant 2 */}
            <button className="text-left group flex items-center justify-between p-4 boa-surface hover:border-[color:var(--boa-brass)] transition-colors rounded-sm cursor-pointer">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="boa-display text-xl text-[color:var(--boa-ink)] group-hover:text-[color:var(--boa-brass)] transition-colors">
                    Northwind Foundry
                  </span>
                  <span className="boa-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border border-[color:var(--boa-paper-3)] bg-[color:var(--boa-paper-2)] text-[color:var(--boa-ink-3)]">
                    Editor
                  </span>
                </div>
                <div className="flex items-center gap-3 boa-mono text-[10px] text-[color:var(--boa-ink-3)] opacity-70">
                  <span className="boa-num">5 MEMBERS</span>
                  <span>·</span>
                  <span>LAST VISITED YESTERDAY</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[color:var(--boa-paper-3)] group-hover:text-[color:var(--boa-brass)] transition-colors" />
            </button>

            {/* Tenant 3 */}
            <button className="text-left group flex items-center justify-between p-4 boa-surface hover:border-[color:var(--boa-brass)] transition-colors rounded-sm cursor-pointer">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="boa-display text-xl text-[color:var(--boa-ink)] group-hover:text-[color:var(--boa-brass)] transition-colors">
                    Cinder & Bloom
                  </span>
                  <span className="boa-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border border-[color:var(--boa-paper-3)] bg-[color:var(--boa-paper-2)] text-[color:var(--boa-ink-3)]">
                    Viewer
                  </span>
                </div>
                <div className="flex items-center gap-3 boa-mono text-[10px] text-[color:var(--boa-ink-3)] opacity-70">
                  <span className="boa-num">3 MEMBERS</span>
                  <span>·</span>
                  <span>LAST VISITED 9 DAYS AGO</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[color:var(--boa-paper-3)] group-hover:text-[color:var(--boa-brass)] transition-colors" />
            </button>
          </div>

          <button className="mt-6 flex items-center justify-center gap-2 w-full p-4 border border-dashed border-[color:var(--boa-ink-3)] text-[color:var(--boa-ink-3)] hover:text-[color:var(--boa-ink)] hover:border-[color:var(--boa-ink)] transition-colors rounded-sm cursor-pointer">
            <Plus className="w-4 h-4" />
            <span className="text-[13px] font-medium">Create new tenant</span>
          </button>
        </div>

        {/* Mobile SSO footnote */}
        <div className="absolute bottom-8 left-0 right-0 text-center md:hidden">
          <div className="boa-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "rgba(20,20,26,0.4)" }}>
            Authenticated via Replit
          </div>
          <div className="boa-mono text-[10px] mt-0.5" style={{ color: "var(--boa-ink)" }}>
            emarsh@helixcapital.com
          </div>
        </div>

      </div>
    </div>
  );
}
