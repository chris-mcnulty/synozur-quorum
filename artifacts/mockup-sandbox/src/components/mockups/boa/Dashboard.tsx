import React from "react";
import { AppLayout } from "./_shared/AppLayout";
import { ArrowRight, ArrowUpRight, TrendingUp, Search, Plus } from "lucide-react";

export function Dashboard() {
  const crumbs = [{ label: "Helix Capital" }, { label: "Overview" }];

  const rightSlot = (
    <button className="boa-cta-brass px-3 py-1.5 rounded-sm text-[12px] flex items-center gap-1.5 transition-colors font-medium">
      <Plus className="w-3.5 h-3.5" />
      Convene session
    </button>
  );

  return (
    <AppLayout active="dashboard" tenant="Helix Capital" crumbs={crumbs} rightSlot={rightSlot}>
      <div className="max-w-[1200px] mx-auto px-8 py-10">
        
        {/* Masthead */}
        <header className="mb-10">
          <h1 className="boa-display text-[42px] leading-tight mb-2" style={{ color: "var(--boa-ink)" }}>
            Helix Capital
          </h1>
          <div className="flex items-center gap-3">
            <div className="boa-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--boa-ink-3)" }}>
              6 BOARDS · 182 SESSIONS · 47 GROUNDING DOCS
            </div>
            <div className="w-1 h-1 rounded-full" style={{ background: "var(--boa-paper-3)" }} />
            <div className="text-[13px]" style={{ color: "var(--boa-ink-3)" }}>
              12 members, established March 2026
            </div>
          </div>
        </header>

        {/* KPI Row */}
        <div className="grid grid-cols-4 border-y boa-rule mb-12">
          <KpiTile 
            label="Sessions this week" 
            value="24" 
            trend="+3" 
            trendUp={true} 
            sparkline={true} 
            className="border-r boa-rule" 
          />
          <KpiTile 
            label="Avg. session cost" 
            value="$0.46" 
            trend="+8%" 
            trendUp={false} 
            className="border-r boa-rule" 
          />
          <KpiTile 
            label="Avg. consensus" 
            value="78%" 
            trend="-2%" 
            trendUp={false} 
            className="border-r boa-rule" 
          />
          <KpiTile 
            label="Active boards" 
            value="4 / 6" 
            trend="Stable" 
            trendUp={true} 
            className="" 
          />
        </div>

        {/* Main Content Split */}
        <div className="flex items-start gap-12">
          
          {/* Left: Feed */}
          <div className="flex-[3]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="boa-display text-[22px]">Recent council activity</h2>
              <button className="text-[12px] flex items-center gap-1 hover:underline" style={{ color: "var(--boa-ink-3)" }}>
                View ledger <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="border-t border-b boa-rule-strong divide-y boa-rule">
              {SESSIONS.map((session, i) => (
                <div key={i} className="py-3 flex items-start gap-4 hover:bg-[rgba(20,20,26,0.01)] transition-colors cursor-pointer group">
                  <div className="w-[45px] shrink-0 pt-0.5">
                    <div className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>{session.time}</div>
                  </div>
                  
                  <div className="w-[140px] shrink-0 pt-0.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: session.color }} />
                      <div className="text-[12px] font-medium truncate">{session.board}</div>
                    </div>
                    <div className="boa-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm inline-block" style={{ background: "rgba(20,20,26,0.04)", color: "var(--boa-ink-2)" }}>
                      {session.mode}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="text-[14px] italic leading-snug mb-1.5 text-[color:var(--boa-ink-2)] group-hover:text-[color:var(--boa-ink)] transition-colors">
                      "{session.question}"
                    </div>
                    <div className="flex items-center gap-3 boa-mono text-[10px] text-[color:var(--boa-ink-3)]">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full flex items-center justify-center border boa-rule bg-white text-[7px] font-bold">∑</span>
                        {session.tokens} tok
                      </span>
                      <span>·</span>
                      <span>{session.duration}</span>
                    </div>
                  </div>

                  <div className="w-[90px] shrink-0 text-right pt-0.5 flex flex-col items-end">
                    <div className="boa-mono text-[11px] mb-1">
                      {session.outcome.type === 'consensus' ? (
                        <span>{session.outcome.value}%</span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span style={{ color: "var(--boa-vote-yes)" }}>{session.outcome.yes}</span>
                          <span style={{ color: "var(--boa-ink-3)" }}>–</span>
                          <span style={{ color: "var(--boa-vote-no)" }}>{session.outcome.no}</span>
                          <span className="ml-0.5">{session.outcome.result}</span>
                        </span>
                      )}
                    </div>
                    <div className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
                      {session.cost}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 flex justify-center">
              <button className="boa-mono text-[10px] uppercase tracking-widest hover:underline" style={{ color: "var(--boa-ink-3)" }}>
                Load earlier sessions
              </button>
            </div>
          </div>

          {/* Right: Panels */}
          <div className="flex-[2] space-y-10">
            
            {/* Topics */}
            <section>
              <h3 className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-4" style={{ color: "var(--boa-ink-3)" }}>
                Boards by topic area
              </h3>
              <div className="space-y-2 text-[13px]">
                <TopicRow name="Capital Allocation" count="42" />
                <TopicRow name="Risk & Compliance" count="38" />
                <TopicRow name="Technology Strategy" count="29" />
                <TopicRow name="Talent & Operations" count="17" />
                <TopicRow name="Market Expansion" count="12" />
              </div>
            </section>

            {/* People */}
            <section>
              <h3 className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-4 flex items-center justify-between" style={{ color: "var(--boa-ink-3)" }}>
                <span>Active Advisors</span>
                <span className="hover:underline cursor-pointer">View directory</span>
              </h3>
              <div className="space-y-3">
                {PEOPLE.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center boa-display text-[14px]" style={{ background: "var(--boa-paper-3)", color: "var(--boa-ink)" }}>
                      {p.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{p.name}</div>
                      <div className="boa-mono text-[9px] uppercase tracking-wider truncate" style={{ color: "var(--boa-ink-3)" }}>
                        {p.role}
                      </div>
                    </div>
                    <div className="boa-mono text-[10px] bg-[rgba(20,20,26,0.04)] px-1.5 py-0.5 rounded-sm" style={{ color: "var(--boa-ink-3)" }}>
                      {p.model}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Open Questions */}
            <section>
              <h3 className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-4" style={{ color: "var(--boa-ink-3)" }}>
                Open questions across council
              </h3>
              <div className="space-y-4">
                {QUESTIONS.map((q, i) => (
                  <div key={i} className="group cursor-pointer">
                    <div className="text-[13px] leading-snug mb-1.5 group-hover:text-[color:var(--boa-brass)] transition-colors">
                      {q.text}
                    </div>
                    <div className="flex items-center gap-2 boa-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--boa-ink-3)" }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: q.color }} />
                      <span>from {q.board}</span>
                      <span>·</span>
                      <span>{q.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>

      </div>
    </AppLayout>
  );
}

function KpiTile({ label, value, trend, trendUp, sparkline = false, className = "" }: { label: string, value: string, trend: string, trendUp: boolean, sparkline?: boolean, className?: string }) {
  return (
    <div className={`p-5 pl-0 first:pl-2 flex flex-col ${className}`}>
      <div className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: "var(--boa-ink-3)" }}>
        {label}
      </div>
      <div className="flex items-baseline gap-3 mb-1">
        <div className="boa-display boa-num text-[32px] leading-none">
          {value}
        </div>
        <div className="boa-mono text-[11px] flex items-center gap-0.5" style={{ color: trendUp ? "var(--boa-vote-yes)" : "var(--boa-vote-no)" }}>
          {trendUp ? "▲" : "▼"} {trend}
        </div>
      </div>
      {sparkline && (
        <div className="mt-2 h-6 flex items-end gap-1 opacity-40">
          {[4, 7, 3, 8, 5, 12, 8].map((h, i) => (
            <div key={i} className="w-1.5 rounded-t-sm" style={{ height: `${h * 2}px`, background: "var(--boa-ink)" }} />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicRow({ name, count }: { name: string, count: string }) {
  return (
    <div className="flex items-baseline w-full group cursor-pointer">
      <span className="font-medium group-hover:text-[color:var(--boa-brass)] transition-colors">{name}</span>
      <span className="flex-1 mx-2 overflow-hidden text-[color:var(--boa-paper-3)]" aria-hidden="true">
        ......................................................................................................................
      </span>
      <span className="boa-mono text-[11px]">{count}</span>
    </div>
  );
}

// Dummy Data

const SESSIONS = [
  {
    time: "14m",
    board: "Capital Allocation",
    color: "var(--boa-brass)",
    mode: "BOARD",
    question: "Should we participate in the Series C for Northwind Foundry at a $1.2B valuation, given our existing exposure in the logistics sector?",
    outcome: { type: "vote", yes: 4, no: 1, result: "YES" },
    cost: "$0.84",
    tokens: "24.2k",
    duration: "42s"
  },
  {
    time: "2h",
    board: "Risk & Compliance",
    color: "var(--boa-aubergine)",
    mode: "ADVISORY",
    question: "Explore potential regulatory headwinds for autonomous drone delivery in EU markets over the next 24 months.",
    outcome: { type: "consensus", value: 84 },
    cost: "$0.32",
    tokens: "12.8k",
    duration: "18s"
  },
  {
    time: "5h",
    board: "Technology Strategy",
    color: "var(--boa-flag)",
    mode: "REVIEW",
    question: "Post-mortem: the decision to migrate core infra to the new provider. What signals did we miss during the technical diligence?",
    outcome: { type: "consensus", value: 92 },
    cost: "$1.15",
    tokens: "38.5k",
    duration: "1m 12s"
  },
  {
    time: "1d",
    board: "Capital Allocation",
    color: "var(--boa-brass)",
    mode: "ADVISORY",
    question: "Assess the viability of divesting the commercial real estate portfolio ahead of anticipated rate hikes.",
    outcome: { type: "consensus", value: 65 },
    cost: "$0.45",
    tokens: "15.1k",
    duration: "24s"
  },
  {
    time: "1d",
    board: "Talent & Operations",
    color: "var(--boa-vote-yes)",
    mode: "BOARD",
    question: "Approve the proposed executive compensation restructure integrating long-term ESG targets into the bonus pool.",
    outcome: { type: "vote", yes: 3, no: 2, result: "YES" },
    cost: "$0.68",
    tokens: "19.4k",
    duration: "31s"
  },
  {
    time: "2d",
    board: "Market Expansion",
    color: "var(--boa-ink)",
    mode: "BOARD",
    question: "Commit $15M to the Southeast Asia market entry pilot program over the next 4 quarters.",
    outcome: { type: "vote", yes: 2, no: 3, result: "NO" },
    cost: "$0.72",
    tokens: "21.0k",
    duration: "38s"
  },
  {
    time: "3d",
    board: "Risk & Compliance",
    color: "var(--boa-aubergine)",
    mode: "ADVISORY",
    question: "Analyze exposure to supply chain disruptions resulting from the recent geopolitical events in the South China Sea.",
    outcome: { type: "consensus", value: 88 },
    cost: "$1.40",
    tokens: "42.1k",
    duration: "1m 05s"
  },
  {
    time: "4d",
    board: "Capital Allocation",
    color: "var(--boa-brass)",
    mode: "REVIEW",
    question: "Review performance of the Q1 micro-cap acquisition strategy against initial projections.",
    outcome: { type: "consensus", value: 72 },
    cost: "$0.95",
    tokens: "28.3k",
    duration: "45s"
  }
];

const PEOPLE = [
  { initials: "MH", name: "Margot Hale", role: "Capital Allocator", model: "opus-4-1" },
  { initials: "IS", name: "Idris Saito", role: "Operations Lead", model: "sonnet-4-5" },
  { initials: "RC", name: "Reema Chaudhuri", role: "Risk Assessor", model: "opus-4-1" },
  { initials: "VL", name: "Victor Vance", role: "Market Strategist", model: "sonnet-4-5" },
  { initials: "EK", name: "Elena Kemp", role: "Legal Counsel", model: "opus-4-1" }
];

const QUESTIONS = [
  {
    text: "Should we accelerate the depreciation schedule for legacy data center hardware?",
    board: "Capital Allocation",
    color: "var(--boa-brass)",
    time: "2h ago"
  },
  {
    text: "What are the secondary impacts of the new remote work policy on inter-departmental innovation?",
    board: "Talent & Ops",
    color: "var(--boa-vote-yes)",
    time: "5h ago"
  },
  {
    text: "Evaluate the systemic risk of vendor lock-in with our primary cloud provider over a 5-year horizon.",
    board: "Tech Strategy",
    color: "var(--boa-flag)",
    time: "1d ago"
  }
];
