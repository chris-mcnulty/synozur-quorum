import { AppLayout } from "./_shared/AppLayout";
import { Play, Square } from "lucide-react";

export function SessionRunner() {
  const crumbs = [
    { label: "Helix Capital" },
    { label: "Sessions", href: "#" },
    { label: "Live · Capital Allocation Council" },
  ];

  const rightSlot = (
    <div className="flex items-center gap-3">
      <div
        className="boa-mono text-[10px] px-2 py-1 rounded-sm uppercase tracking-[0.15em]"
        style={{
          background: "var(--boa-brass)",
          color: "#fff",
        }}
      >
        Board
      </div>
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border rounded-sm transition-colors"
        style={{
          borderColor: "var(--boa-ink)",
          color: "var(--boa-ink)",
        }}
      >
        <Square className="w-3 h-3" fill="currentColor" />
        Stop
      </button>
    </div>
  );

  return (
    <AppLayout active="sessions" tenant="Helix Capital" crumbs={crumbs} rightSlot={rightSlot}>
      <div className="flex h-full">
        {/* LEFT RAIL - Council roster (~22%) */}
        <div className="w-[280px] shrink-0 border-r boa-rule flex flex-col" style={{ background: "var(--boa-paper)" }}>
          <div className="flex-1 overflow-auto p-5">
            <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-4" style={{ color: "var(--boa-ink-3)" }}>
              Council Roster
            </div>
            <div className="space-y-4">
              <RosterItem
                name="Margot Hale"
                role="Capital Allocator"
                status="done"
                meta="1.42s · 312 tok"
                color="#b8893a"
                initials="MH"
              />
              <RosterItem
                name="Idris Saito"
                role="Operations"
                status="done"
                meta="2.10s · 428 tok"
                color="#2f6b4a"
                initials="IS"
              />
              <RosterItem
                name="Reema Chaudhuri"
                role="Risk"
                status="done"
                meta="1.88s · 390 tok"
                color="#8a2f2f"
                initials="RC"
              />
              <RosterItem
                name="Julian Brandt"
                role="Strategy"
                status="done"
                meta="2.05s · 415 tok"
                color="#3b1f3b"
                initials="JB"
              />
              <RosterItem
                name="David Aronoff"
                role="Customer Success"
                status="streaming"
                meta="2.4s elapsed"
                color="#14141a"
                initials="DA"
              />
              <RosterItem
                name="Eun-ji Park"
                role="Devil's Advocate"
                status="streaming"
                meta="2.1s elapsed"
                color="#c46a2a"
                initials="EP"
              />
              <RosterItem
                name="Marcus Vance"
                role="Compliance"
                status="timeout"
                meta="30.0s · no response"
                color="#6b6258"
                initials="MV"
              />
            </div>
          </div>
          <div className="p-5 border-t boa-rule bg-[rgba(0,0,0,0.02)]">
            <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-3" style={{ color: "var(--boa-ink-3)" }}>
              Session Ledger
            </div>
            <div className="space-y-2">
              <LedgerRow label="Started" value="14:32:08" />
              <LedgerRow label="Elapsed" value="0:00:42" pulse />
              <LedgerRow label="Est. Cost" value="$0.18" />
              <div className="pt-2 mt-2 border-t boa-rule border-dashed">
                <LedgerRow label="Master" value="claude-opus-4-1" />
                <LedgerRow label="Member" value="claude-sonnet-4-5" />
              </div>
            </div>
          </div>
        </div>

        {/* CENTER - Transcript (~56%) */}
        <div className="flex-1 overflow-auto flex justify-center">
          <div className="w-full max-w-[720px] px-8 py-10">
            {/* Question */}
            <div className="mb-10">
              <div className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: "var(--boa-brass)" }}>
                Question Posed 14:32:08
              </div>
              <h1 className="boa-display text-[26px] leading-tight italic" style={{ color: "var(--boa-ink)" }}>
                "Should we deploy the next $4M tranche into the operations modernization initiative, or hold reserves against potential Q3 supply-chain shocks?"
              </h1>
            </div>

            {/* Chair's Framing */}
            <div className="mb-12">
              <div className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: "var(--boa-ink-3)" }}>
                Chair's Framing — Master Orchestrator
              </div>
              <div className="text-[14px] leading-relaxed space-y-4" style={{ color: "var(--boa-ink-2)" }}>
                <p>
                  We convene the Capital Allocation Council to resolve the tension between proactive investment and defensive reserving. Helix Capital currently holds $12.4M in liquid reserves, well above our baseline policy of $8M, but Q3 macroeconomic indicators present a mixed outlook for our critical hardware suppliers.
                </p>
                <p>
                  Prior guidance (Session #174) emphasized margin expansion via operations modernization, projecting a 14% efficiency gain over 18 months if fully funded. However, a potential supply-chain shock could increase raw material costs by 8-12%, necessitating additional buffer capital to prevent project stalling.
                </p>
                <p className="italic font-medium">
                  All seven voices invoked under all-hands rule for governance acts. Proceeding to parallel deliberation.
                </p>
              </div>
              <div className="mt-8 border-b boa-rule-strong opacity-20"></div>
            </div>

            {/* Contributions Stream */}
            <div className="space-y-16">
              
              <Contribution
                name="Margot Hale"
                role="Capital Allocator"
                meta="claude-sonnet-4-5 · 842 in / 312 out · 1.42s"
                vote="YES"
                voteText="Net asymmetric upside if executed with milestone gates."
              >
                <p>
                  The opportunity cost of holding excess cash in an inflationary environment outweighs the speculative risk of a supply chain disruption. Our current $12.4M reserve already provides a 50% buffer above policy. By deploying the $4M tranche now, we lock in vendor pricing for the modernization initiative before Q3 adjustments.
                </p>
                <p>
                  Furthermore, delayed deployment pushes our ROI horizon into late next year, compounding the efficiency drag we're currently experiencing in the fulfillment centers. I recommend immediate deployment, structured in two $2M sub-tranches tied to 30-day performance milestones.
                </p>
              </Contribution>

              <Contribution
                name="Idris Saito"
                role="Operations"
                meta="claude-sonnet-4-5 · 842 in / 428 out · 2.10s"
                vote="NO"
                voteText="System cannot absorb simultaneous transformation and external shock."
              >
                <p>
                  While I champion the modernization initiative conceptually, execution reality dictates caution. The operational teams are currently operating at 94% utilization just managing baseline volume. Injecting a massive procedural transformation while staring down potential Q3 supply shortages is a recipe for operational gridlock.
                </p>
                <p>
                  If the supply chain shock materializes, we will need maximum flexibility from our staff to handle expedites and vendor rerouting. We cannot ask them to simultaneously learn the new ERP layer and automated routing systems. Hold the $4M until Q4.
                </p>
              </Contribution>

              <Contribution
                name="Reema Chaudhuri"
                role="Risk"
                meta="claude-sonnet-4-5 · 842 in / 390 out · 1.88s"
                vote="NO"
                voteText="Macro indicators show 60%+ probability of Q3 volatility."
              >
                <p>
                  My risk models strongly indicate holding the reserve. The lead indicators from our tier-1 suppliers in Southeast Asia are already showing 14-day delays on critical components. A $4M deployment leaves us with only $400k of discretionary buffer above policy.
                </p>
                <p>
                  The projected 14% efficiency gain from modernization assumes a stable operating environment. In a disrupted supply chain, those gains will not materialize, meaning the capital is effectively trapped in an underperforming asset while we lack the liquidity to secure alternate sourcing.
                </p>
              </Contribution>

              <Contribution
                name="Julian Brandt"
                role="Strategy"
                meta="claude-sonnet-4-5 · 842 in / 415 out · 2.05s"
                vote="YES"
                voteText="Modernization is a prerequisite for long-term supply resilience."
              >
                <p>
                  We are looking at this backwards. The operations modernization initiative is not just an efficiency play; it is a resilience play. The new systems include predictive vendor routing and automated inventory balancing—exactly the tools we need to mitigate a Q3 supply chain shock.
                </p>
                <p>
                  If we hold the capital, we face the Q3 turbulence with our legacy, fragile processes. Deploying the $4M now accelerates our systemic resilience. It is an aggressive posture, but it is strategically sound.
                </p>
              </Contribution>

              <Contribution
                name="David Aronoff"
                role="Customer Success"
                meta="claude-sonnet-4-5 · 842 in / ... · streaming"
                streaming
              >
                <p>
                  From a customer perspective, our current SLA fulfillment is hovering around 98.2%, which is acceptable but leaving very little room for error. The modernization promises to push that to 99.9%. However, any major transition introduces short-term latency.
                </p>
                <p>
                  If we hit a supply snag mid-transition, the customer experience degradation will be immediate and severe. We would essentially be burning our goodwill capital while trying to optimize<span className="boa-cursor"></span>
                </p>
              </Contribution>

              <Contribution
                name="Eun-ji Park"
                role="Devil's Advocate"
                meta="claude-sonnet-4-5 · 842 in / ... · streaming"
                streaming
              >
                <p>
                  Let's challenge the premise that these are our only two options. Why is it a binary choice between a full $4M tranche and holding complete reserves? The false dichotomy is forcing a brittle decision.
                </p>
                <p>
                  What if we deployed a $1.5M micro-tranche focused exclusively on the software layer of the modernization, holding $2.5M back as a hybrid buffer<span className="boa-cursor"></span>
                </p>
              </Contribution>

              <div className="border-l-2 border-[var(--boa-vote-no)] pl-6 py-2">
                <div className="boa-display font-semibold text-[18px] mb-1" style={{ color: "var(--boa-ink)" }}>
                  Marcus Vance <span className="text-[16px] italic font-normal text-[var(--boa-ink-3)]">— Compliance</span>
                </div>
                <div className="boa-mono text-[10px] text-[var(--boa-vote-no)] mb-4">
                  claude-sonnet-4-5 · timeout · 30.0s
                </div>
                <div className="text-[14px] italic" style={{ color: "var(--boa-vote-no)" }}>
                  Member did not respond within 30s. Vote not counted.
                </div>
              </div>

            </div>

            {/* Convergence Placeholder */}
            <div className="mt-16 pt-8 border-t boa-rule border-dashed">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[var(--boa-brass)] boa-pulse"></div>
                <div className="boa-mono text-[11px] uppercase tracking-[0.15em] text-[var(--boa-ink-3)]">
                  Master synthesizing divergence...
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT RAIL - Vote Tally (~22%) */}
        <div className="w-[280px] shrink-0 border-l boa-rule p-6 flex flex-col bg-[var(--boa-paper)]">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="boa-display text-[22px]">Tally</h2>
            <div className="boa-mono text-[11px] text-[var(--boa-ink-3)]">
              4 / 7 voices in
            </div>
          </div>

          {/* Stacked Bar */}
          <div className="h-48 w-8 bg-[rgba(0,0,0,0.04)] rounded-sm mx-auto mb-8 flex flex-col-reverse overflow-hidden border boa-rule">
            <div style={{ height: "42.8%", background: "var(--boa-vote-yes)" }}></div>
            <div style={{ height: "28.5%", background: "var(--boa-vote-no)" }}></div>
          </div>

          <div className="grid grid-cols-3 text-center mb-10 gap-2">
            <div>
              <div className="boa-display boa-num text-[24px]" style={{ color: "var(--boa-vote-yes)" }}>3</div>
              <div className="boa-mono text-[9px] uppercase tracking-wider">Yes</div>
            </div>
            <div>
              <div className="boa-display boa-num text-[24px]" style={{ color: "var(--boa-vote-no)" }}>2</div>
              <div className="boa-mono text-[9px] uppercase tracking-wider">No</div>
            </div>
            <div>
              <div className="boa-display boa-num text-[24px]" style={{ color: "var(--boa-vote-abs)" }}>0</div>
              <div className="boa-mono text-[9px] uppercase tracking-wider">Abs</div>
            </div>
          </div>

          <div className="space-y-2 mb-10">
            <VoteRow name="Hale" vote="YES" color="var(--boa-vote-yes)" />
            <VoteRow name="Brandt" vote="YES" color="var(--boa-vote-yes)" />
            <VoteRow name="Saito" vote="NO" color="var(--boa-vote-no)" />
            <VoteRow name="Chaudhuri" vote="NO" color="var(--boa-vote-no)" />
            <VoteRow name="Aronoff" vote="PENDING" color="var(--boa-ink-3)" />
            <VoteRow name="Park" vote="PENDING" color="var(--boa-ink-3)" />
            <VoteRow name="Vance" vote="TIMEOUT" color="var(--boa-vote-no)" />
          </div>

          <div className="boa-mono text-[10px] italic text-[var(--boa-ink-3)] leading-relaxed mb-auto">
            Quorum requires majority of 7 = 4. Result pending.
          </div>

          {/* Question Metadata Panel */}
          <div className="mt-8 p-4 border boa-rule bg-[rgba(0,0,0,0.02)] rounded-sm">
            <div className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-3 text-[var(--boa-ink-3)]">
              Question Metadata
            </div>
            <div className="space-y-1.5">
              <MetaRow label="Mode" value="BOARD" />
              <MetaRow label="Est. Facts" value="842 chars" />
              <MetaRow label="Started At" value="14:32:08 UTC" />
              <MetaRow label="Master Temp" value="0.7" />
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}

// Sub-components

function RosterItem({ name, role, status, meta, color, initials }: any) {
  return (
    <div className="flex items-start gap-3">
      <div 
        className="w-6 h-6 rounded-full flex items-center justify-center boa-mono text-[9px] shrink-0 mt-0.5"
        style={{ background: color, color: "#fff" }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="boa-display text-[15px] truncate text-[var(--boa-ink)]">{name}</div>
          {status === 'done' && (
            <div className="boa-mono text-[9px] text-[var(--boa-vote-yes)] shrink-0">✓ DONE</div>
          )}
          {status === 'streaming' && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--boa-brass)] boa-pulse"></div>
              <div className="boa-mono text-[9px] text-[var(--boa-brass)]">STREAMING</div>
            </div>
          )}
          {status === 'timeout' && (
            <div className="boa-mono text-[9px] text-[var(--boa-vote-no)] shrink-0">TIMEOUT</div>
          )}
        </div>
        <div className="text-[12px] italic text-[var(--boa-ink-3)] mb-1">{role}</div>
        <div className="boa-mono text-[9px] text-[var(--boa-ink-3)]">{meta}</div>
        {status === 'streaming' && (
          <div className="h-[2px] w-full bg-[rgba(0,0,0,0.05)] mt-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--boa-brass)] w-2/3"></div>
          </div>
        )}
      </div>
    </div>
  );
}

function LedgerRow({ label, value, pulse }: any) {
  return (
    <div className="flex justify-between items-baseline text-[11px]">
      <span className="text-[var(--boa-ink-3)]">{label}</span>
      <span className={`boa-mono ${pulse ? 'text-[var(--boa-brass)]' : 'text-[var(--boa-ink)]'}`}>
        {value}
      </span>
    </div>
  );
}

function Contribution({ name, role, meta, vote, voteText, streaming, children }: any) {
  return (
    <div className="relative">
      <div className="boa-display font-semibold text-[18px] mb-1" style={{ color: "var(--boa-ink)" }}>
        {name} <span className="text-[16px] italic font-normal text-[var(--boa-ink-3)]">— {role}</span>
      </div>
      <div className="boa-mono text-[10px] text-[var(--boa-ink-3)] mb-4">
        {meta}
      </div>
      <div className="text-[14px] leading-relaxed space-y-4 text-[var(--boa-ink-2)]">
        {children}
      </div>
      
      {vote && (
        <div className="mt-5 pt-4 border-t boa-rule">
          <div className="flex items-start gap-2">
            <div 
              className="boa-mono text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm shrink-0"
              style={{ 
                background: vote === 'YES' ? 'var(--boa-vote-yes)' : vote === 'NO' ? 'var(--boa-vote-no)' : 'var(--boa-vote-abs)',
                color: '#fff'
              }}
            >
              VOTE: {vote}
            </div>
            <div className="text-[13px] text-[var(--boa-ink)] font-medium mt-0.5">
              {voteText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VoteRow({ name, vote, color }: any) {
  return (
    <div className="flex justify-between items-baseline text-[11px]">
      <span className="boa-mono text-[var(--boa-ink-2)]">{name}</span>
      <span className="boa-mono font-bold" style={{ color }}>{vote}</span>
    </div>
  );
}

function MetaRow({ label, value }: any) {
  return (
    <div className="flex justify-between items-baseline text-[10px]">
      <span className="text-[var(--boa-ink-3)]">{label}</span>
      <span className="boa-mono text-[var(--boa-ink-2)]">{value}</span>
    </div>
  );
}
