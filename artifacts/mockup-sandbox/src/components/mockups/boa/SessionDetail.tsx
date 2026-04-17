import * as React from "react";
import { AppLayout } from "./_shared/AppLayout";
import { Printer, RefreshCw, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SessionDetail() {
  const crumbs = [
    { label: "Helix Capital" },
    { label: "Sessions", href: "#" },
    { label: "Session #00184 · Brand & Story" },
  ];

  const rightSlot = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="h-8 boa-mono text-[10px] uppercase tracking-wider text-[color:var(--boa-ink-2)] border-[color:var(--boa-paper-3)] bg-transparent hover:bg-[color:var(--boa-paper-2)]">
        <Printer className="w-3 h-3 mr-1.5" />
        Print
      </Button>
      <Button variant="outline" size="sm" className="h-8 boa-mono text-[10px] uppercase tracking-wider text-[color:var(--boa-ink-2)] border-[color:var(--boa-paper-3)] bg-transparent hover:bg-[color:var(--boa-paper-2)]">
        <RefreshCw className="w-3 h-3 mr-1.5" />
        Re-convene with same question
      </Button>
    </div>
  );

  const toc = [
    { id: "masthead", label: "Masthead" },
    { id: "question", label: "Question" },
    { id: "facts", label: "Established facts" },
    { id: "framing", label: "Chair's framing" },
    { id: "contributions", label: "Contributions (5)" },
    { id: "tally", label: "Vote tally" },
    { id: "convergence", label: "Convergence", active: true },
    { id: "open", label: "Open questions" },
    { id: "flags", label: "Flags raised" },
    { id: "cost", label: "Cost & metadata" },
    { id: "audit", label: "Audit" },
  ];

  return (
    <AppLayout active="sessions" tenant="Helix Capital" crumbs={crumbs} rightSlot={rightSlot}>
      <div className="max-w-[1200px] mx-auto px-8 lg:px-12 py-12 flex items-start gap-16 relative">
        
        {/* LEFT TOC RAIL */}
        <aside className="w-[220px] shrink-0 sticky top-12 hidden md:block">
          <nav className="flex flex-col gap-2.5">
            {toc.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`boa-mono text-[11px] uppercase tracking-[0.15em] transition-colors ${
                  item.active
                    ? "text-[color:var(--boa-brass)] font-bold"
                    : "text-[color:var(--boa-ink-3)] hover:text-[color:var(--boa-ink)]"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* RIGHT DOCUMENT */}
        <article className="flex-1 min-w-0 pb-32">
          
          {/* 1. Masthead */}
          <header id="masthead" className="mb-16">
            <div className="boa-mono text-[12px] uppercase tracking-[0.2em] text-[color:var(--boa-ink-3)] mb-6">
              Minutes — Session #00184
            </div>
            <h1 className="boa-display text-[44px] leading-[1.1] text-[color:var(--boa-ink)] mb-8">
              Naming the new flagship product line
            </h1>
            <div className="border border-[color:var(--boa-rule)] p-4 rounded-sm bg-[color:rgba(245,241,234,0.3)]">
              <div className="flex flex-wrap gap-x-6 gap-y-3 boa-mono text-[11px] text-[color:var(--boa-ink-2)]">
                <div><span className="text-[color:var(--boa-ink-3)] mr-2">Board</span> Brand & Story</div>
                <div><span className="text-[color:var(--boa-ink-3)] mr-2">Mode</span> ADVISORY</div>
                <div><span className="text-[color:var(--boa-ink-3)] mr-2">Convened</span> Apr 12 2026 14:01 PT by Elena Marsh</div>
                <div><span className="text-[color:var(--boa-ink-3)] mr-2">Completed</span> Apr 12 2026 14:02:34 PT (1m 26s)</div>
                <div><span className="text-[color:var(--boa-ink-3)] mr-2">Status</span> Complete</div>
                <div><span className="text-[color:var(--boa-ink-3)] mr-2">Master</span> claude-opus-4-1</div>
                <div><span className="text-[color:var(--boa-ink-3)] mr-2">Members</span> 5 of 5 returned</div>
                <div><span className="text-[color:var(--boa-ink-3)] mr-2">Total cost</span> $0.41 (84,212 in + 12,640 out)</div>
              </div>
            </div>
          </header>

          <SectionDivider />

          {/* 2. Question */}
          <section id="question" className="mb-16 relative">
            <SectionHeader title="Question" />
            <div className="boa-display text-[26px] leading-[1.4] italic text-[color:var(--boa-ink)] pr-12">
              "We are launching a new tier of intelligent business banking that automatically categorizes spend, predicts cash flow issues, and generates draft invoices. It sits above our standard 'Pro' tier. What should we name it to communicate sophisticated automation without sounding cold or clinical?"
            </div>
          </section>

          <SectionDivider />

          {/* 3. Established facts */}
          <section id="facts" className="mb-16">
            <SectionHeader title="Established facts" />
            <ol className="list-decimal list-outside ml-5 space-y-4 text-[15px] leading-relaxed text-[color:var(--boa-ink-2)] max-w-3xl">
              <li className="pl-2">The product will be priced at $199/month, targeting companies with $1M-$10M in annual revenue.</li>
              <li className="pl-2">Competitors use names like "Scale", "Infinite", "Quantum", and "Treasury". We wish to avoid these overused SaaS tropes.</li>
              <li className="pl-2">Our existing tiers are "Starter" and "Pro". This new tier must feel like a definitive leap, not just "Pro Plus".</li>
            </ol>
          </section>

          <SectionDivider />

          {/* 4. Chair's framing */}
          <section id="framing" className="mb-16">
            <SectionHeader title="Chair's framing" />
            <div className="space-y-5 text-[15px] leading-relaxed text-[color:var(--boa-ink-2)] max-w-3xl">
              <p>
                The challenge here is balancing the perceived warmth of our brand (Helix) with the hard technical reality of what this product does. It is essentially an algorithmic CFO, but if we name it something too robotic, we alienate founders who already find finance intimidating.
              </p>
              <p>
                I want the board to explore names that evoke clarity, foresight, and orchestration. Avoid names that imply aggression or unchecked scale. The tone should be quietly capable.
              </p>
            </div>
          </section>

          <SectionDivider />

          {/* 5. Contributions */}
          <section id="contributions" className="mb-16">
            <SectionHeader title="Contributions (5)" />
            
            <div className="space-y-12">
              {/* Member 1 */}
              <div className="relative">
                <div className="absolute -right-8 top-1 hidden xl:block w-48 boa-mono text-[10px] text-[color:var(--boa-ink-3)] text-right leading-relaxed">
                  [claude-sonnet-4-5]<br/>
                  1,240 tok · 4.2s lat<br/>
                  View full trace ↗
                </div>
                <h3 className="boa-display text-[22px] font-semibold text-[color:var(--boa-ink)] mb-1">
                  Coral Vance
                </h3>
                <div className="boa-mono text-[11px] text-[color:var(--boa-ink-3)] mb-4">
                  Brand Storyteller · Prompt variant #4B
                </div>
                <div className="space-y-4 text-[15px] leading-relaxed text-[color:var(--boa-ink-2)] max-w-3xl mb-4">
                  <p>
                    We need a name that feels like lifting a fog. When founders struggle with cash flow, it's a visibility problem. "Pro" is about doing the work; this tier is about *seeing* the work already done for you. I lean toward names that evoke lenses, vantage points, or quiet atmospheres.
                  </p>
                  <p>
                    Let's avoid mechanical prefixes ("Auto", "Smart") entirely. We should look at terms from navigation or meteorology that imply seeing further ahead than everyone else.
                  </p>
                </div>
                <div className="boa-mono text-[12px] bg-[color:var(--boa-paper-2)] inline-flex px-3 py-2 rounded-sm text-[color:var(--boa-ink)]">
                  <span className="text-[color:var(--boa-ink-3)] mr-3">Recommends:</span> Helix Vantage
                </div>
              </div>

              {/* Member 2 */}
              <div className="relative pt-10 border-t border-[color:var(--boa-rule)]">
                 <div className="absolute -right-8 top-11 hidden xl:block w-48 boa-mono text-[10px] text-[color:var(--boa-ink-3)] text-right leading-relaxed">
                  [gpt-4-turbo]<br/>
                  1,180 tok · 5.8s lat<br/>
                  View full trace ↗
                </div>
                <h3 className="boa-display text-[22px] font-semibold text-[color:var(--boa-ink)] mb-1">
                  August Pereira
                </h3>
                <div className="boa-mono text-[11px] text-[color:var(--boa-ink-3)] mb-4">
                  Naming Linguist · Prompt variant #1A
                </div>
                <div className="space-y-4 text-[15px] leading-relaxed text-[color:var(--boa-ink-2)] max-w-3xl mb-4">
                  <p>
                    I disagree slightly with Coral on meteorology—it can feel unpredictable. I prefer structural or orchestral terms. The product harmonizes disparate data streams (spend, invoicing, bank feed) into one cohesive rhythm.
                  </p>
                  <p>
                    We should look for trochaic meter (stressed-unstressed) which sounds confident and grounded. Words ending in soft consonants or open vowels feel premium.
                  </p>
                </div>
                <div className="boa-mono text-[12px] bg-[color:var(--boa-paper-2)] inline-flex px-3 py-2 rounded-sm text-[color:var(--boa-ink)]">
                  <span className="text-[color:var(--boa-ink-3)] mr-3">Recommends:</span> Helix Cadence
                </div>
              </div>

              {/* Member 3 */}
              <div className="relative pt-10 border-t border-[color:var(--boa-rule)]">
                 <div className="absolute -right-8 top-11 hidden xl:block w-48 boa-mono text-[10px] text-[color:var(--boa-ink-3)] text-right leading-relaxed">
                  [claude-sonnet-4-5]<br/>
                  1,305 tok · 4.5s lat<br/>
                  View full trace ↗
                </div>
                <h3 className="boa-display text-[22px] font-semibold text-[color:var(--boa-ink)] mb-1">
                  Lina Okafor
                </h3>
                <div className="boa-mono text-[11px] text-[color:var(--boa-ink-3)] mb-4">
                  Customer Voice · Prompt variant #2C
                </div>
                <div className="space-y-4 text-[15px] leading-relaxed text-[color:var(--boa-ink-2)] max-w-3xl mb-4">
                  <p>
                    Looking at our user interviews, the most common phrase founders use when describing their ideal state is "having a handle on things." They want control without the manual labor.
                  </p>
                  <p>
                    Vantage and Cadence are nice, but perhaps too abstract for a $199/mo purchase. They need to know this tier is doing heavy lifting. I suggest something that implies a guiding force or an active partner, rather than just a perspective.
                  </p>
                </div>
                <div className="boa-mono text-[12px] bg-[color:var(--boa-paper-2)] inline-flex px-3 py-2 rounded-sm text-[color:var(--boa-ink)]">
                  <span className="text-[color:var(--boa-ink-3)] mr-3">Recommends:</span> Helix Steer
                </div>
              </div>

              {/* Member 4 */}
              <div className="relative pt-10 border-t border-[color:var(--boa-rule)]">
                 <div className="absolute -right-8 top-11 hidden xl:block w-48 boa-mono text-[10px] text-[color:var(--boa-ink-3)] text-right leading-relaxed">
                  [gpt-4-turbo]<br/>
                  950 tok · 3.2s lat<br/>
                  View full trace ↗
                </div>
                <h3 className="boa-display text-[22px] font-semibold text-[color:var(--boa-ink)] mb-1">
                  Marcus Trent
                </h3>
                <div className="boa-mono text-[11px] text-[color:var(--boa-ink-3)] mb-4">
                  Devil's Advocate · Prompt variant #5A
                </div>
                <div className="space-y-4 text-[15px] leading-relaxed text-[color:var(--boa-ink-2)] max-w-3xl mb-4">
                  <p>
                    If we charge $199/mo, it needs to sound like an institution, not a feature. "Steer" sounds like a feature. "Cadence" sounds like an HR tool. 
                  </p>
                  <p>
                    We shouldn't run from the concept of intelligence. Let's own the algorithm. If we want to avoid "Smart", let's use words that imply synthesis. This tier thinks, it doesn't just display. 
                  </p>
                </div>
                <div className="boa-mono text-[12px] bg-[color:var(--boa-paper-2)] inline-flex px-3 py-2 rounded-sm text-[color:var(--boa-ink)]">
                  <span className="text-[color:var(--boa-ink-3)] mr-3">Recommends:</span> Helix Synthesis
                </div>
              </div>

              {/* Member 5 */}
              <div className="relative pt-10 border-t border-[color:var(--boa-rule)]">
                 <div className="absolute -right-8 top-11 hidden xl:block w-48 boa-mono text-[10px] text-[color:var(--boa-ink-3)] text-right leading-relaxed">
                  [claude-sonnet-4-5]<br/>
                  1,112 tok · 4.0s lat<br/>
                  View full trace ↗
                </div>
                <h3 className="boa-display text-[22px] font-semibold text-[color:var(--boa-ink)] mb-1">
                  Nia Bellamy
                </h3>
                <div className="boa-mono text-[11px] text-[color:var(--boa-ink-3)] mb-4">
                  Visual Director · Prompt variant #3B
                </div>
                <div className="space-y-4 text-[15px] leading-relaxed text-[color:var(--boa-ink-2)] max-w-3xl mb-4">
                  <p>
                    From a visual identity perspective, "Synthesis" is a nightmare to typeset and turn into a simple logo mark. It's too long.
                  </p>
                  <p>
                    We need a short, sharp word that looks elegant in our primary typeface and implies order out of chaos. I agree with August that structural concepts work best. What about the concept of aligning different pieces into a true form?
                  </p>
                </div>
                <div className="boa-mono text-[12px] bg-[color:var(--boa-paper-2)] inline-flex px-3 py-2 rounded-sm text-[color:var(--boa-ink)]">
                  <span className="text-[color:var(--boa-ink-3)] mr-3">Recommends:</span> Helix Align
                </div>
              </div>
            </div>
          </section>

          <SectionDivider />

          {/* 6. Vote tally */}
          <section id="tally" className="mb-16">
            <SectionHeader title="Vote tally" />
            <div className="border border-[color:var(--boa-rule)] bg-[color:rgba(245,241,234,0.3)] p-6 rounded-sm text-center">
              <span className="boa-display italic text-[16px] text-[color:var(--boa-ink-3)]">
                Not applicable — ADVISORY mode
              </span>
            </div>
          </section>

          <SectionDivider />

          {/* 7. Convergence */}
          <section id="convergence" className="mb-16 relative">
            <div className="absolute -left-[45px] top-1">
              <div className="w-8 h-8 rounded-full border border-[color:var(--boa-brass)] flex items-center justify-center bg-[color:var(--boa-brass-tint)] text-[color:var(--boa-brass)]">
                <span className="text-xl leading-none font-serif pt-1">§</span>
              </div>
            </div>
            <h2 className="boa-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--boa-brass)] font-bold mb-6 flex items-center gap-3">
              Convergence note (Master)
              <span className="text-[color:var(--boa-ink-3)] font-normal tracking-normal lowercase text-[10px] bg-[color:var(--boa-paper-2)] px-2 py-0.5 rounded-sm">claude-opus-4-1</span>
            </h2>
            <div className="space-y-5 text-[16px] leading-relaxed text-[color:var(--boa-ink)] max-w-3xl">
              <p>
                The board correctly identified a core tension: the name must convey advanced autonomous capability without sounding coldly algorithmic or alienating to the non-technical founder.
              </p>
              <p>
                There is strong consensus against generic SaaS prefixes ("Auto", "Smart") and overly aggressive terms ("Scale", "Infinite"). However, the board fractured on the primary metaphor. Vance and Okafor prefer guiding/vision metaphors (Vantage, Steer), while Pereira and Bellamy strongly advocate for structural/rhythmic metaphors (Cadence, Align) due to phonetic and visual strengths. Trent correctly notes that $199/mo demands a name with institutional gravity, eliminating overly casual choices.
              </p>
              <p>
                <strong>Synthesis:</strong> The strongest direction emerges from combining Bellamy's need for visual brevity with Pereira's desire for premium phonetics and Trent's demand for gravity. "Cadence" is strong but perhaps too abstract. "Vantage" is clear but lacks action. The Master recommends exploring a third path: terms relating to <em>clarity and distillation</em>. The algorithmic CFO doesn't just steer; it clarifies. 
              </p>
            </div>
            <div className="mt-8 boa-mono text-[13px] bg-[color:var(--boa-ink)] inline-flex px-4 py-3 rounded-sm text-[color:var(--boa-paper)] border border-[color:var(--boa-ink)]">
              <span className="text-[color:var(--boa-paper-3)] mr-3 uppercase tracking-wider text-[11px]">Primary path:</span> 
              Helix Clarity / Helix Lucid / Helix True
            </div>
          </section>

          <SectionDivider />

          {/* 8. Open questions */}
          <section id="open" className="mb-16">
            <SectionHeader title="Open questions" />
            <ul className="list-disc list-outside ml-5 space-y-3 text-[15px] leading-relaxed text-[color:var(--boa-ink-2)] max-w-3xl">
              <li className="pl-2">Does a short, adjective-based name (e.g., "Lucid") step on the toes of the "Pro" tier naming convention?</li>
              <li className="pl-2">Should we conduct a trademark sweep on the "clarity/distillation" concept space before reconvening?</li>
              <li className="pl-2">Trent's point remains: does avoiding "intelligence" terminology undersell the core ML capabilities of the feature?</li>
            </ul>
          </section>

          <SectionDivider />

          {/* 9. Flags raised */}
          <section id="flags" className="mb-16">
            <SectionHeader title="Flags raised" />
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-[color:var(--boa-paper-2)] p-4 rounded-sm border border-[color:var(--boa-rule)]">
                <ShieldCheck className="w-4 h-4 text-[color:var(--boa-vote-yes)] shrink-0 mt-0.5" />
                <div className="boa-mono text-[12px] text-[color:var(--boa-ink-2)] leading-relaxed">
                  Pereira referenced the internal "Customer Voice Q3" document. Boundary check passed: tenant isolation maintained.
                </div>
              </div>
              <div className="flex items-start gap-3 bg-[color:var(--boa-paper-2)] p-4 rounded-sm border border-[color:var(--boa-rule)]">
                <AlertCircle className="w-4 h-4 text-[color:var(--boa-flag)] shrink-0 mt-0.5" />
                <div className="boa-mono text-[12px] text-[color:var(--boa-ink-2)] leading-relaxed">
                  Trent refused the second refinement prompt ("Make it softer"). Refusal text logged and safely bypassed. Session continued.
                </div>
              </div>
            </div>
          </section>

          <SectionDivider />

          {/* 10. Cost & metadata */}
          <section id="cost" className="mb-8">
            <SectionHeader title="Cost & metadata" />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse boa-mono text-[11px] whitespace-nowrap">
                <thead>
                  <tr className="border-b border-[color:var(--boa-rule-strong)]">
                    <th className="py-3 px-2 font-normal text-[color:var(--boa-ink-3)] uppercase tracking-wider">Member</th>
                    <th className="py-3 px-2 font-normal text-[color:var(--boa-ink-3)] uppercase tracking-wider">Model</th>
                    <th className="py-3 px-2 font-normal text-[color:var(--boa-ink-3)] uppercase tracking-wider text-right">In Tokens</th>
                    <th className="py-3 px-2 font-normal text-[color:var(--boa-ink-3)] uppercase tracking-wider text-right">Out Tokens</th>
                    <th className="py-3 px-2 font-normal text-[color:var(--boa-ink-3)] uppercase tracking-wider text-right">Latency</th>
                    <th className="py-3 px-2 font-normal text-[color:var(--boa-ink-3)] uppercase tracking-wider">Status</th>
                    <th className="py-3 px-2 font-normal text-[color:var(--boa-ink-3)] uppercase tracking-wider text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="text-[color:var(--boa-ink-2)] divide-y divide-[color:var(--boa-rule)]">
                  <tr className="hover:bg-[color:var(--boa-paper-2)]">
                    <td className="py-2.5 px-2">C. Vance</td>
                    <td className="py-2.5 px-2">claude-sonnet-4-5</td>
                    <td className="py-2.5 px-2 text-right boa-num">12,450</td>
                    <td className="py-2.5 px-2 text-right boa-num">1,240</td>
                    <td className="py-2.5 px-2 text-right boa-num">4.2s</td>
                    <td className="py-2.5 px-2 text-[color:var(--boa-vote-yes)]">OK</td>
                    <td className="py-2.5 px-2 text-right boa-num">$0.04</td>
                  </tr>
                  <tr className="hover:bg-[color:var(--boa-paper-2)]">
                    <td className="py-2.5 px-2">A. Pereira</td>
                    <td className="py-2.5 px-2">gpt-4-turbo</td>
                    <td className="py-2.5 px-2 text-right boa-num">12,450</td>
                    <td className="py-2.5 px-2 text-right boa-num">1,180</td>
                    <td className="py-2.5 px-2 text-right boa-num">5.8s</td>
                    <td className="py-2.5 px-2 text-[color:var(--boa-vote-yes)]">OK</td>
                    <td className="py-2.5 px-2 text-right boa-num">$0.16</td>
                  </tr>
                  <tr className="hover:bg-[color:var(--boa-paper-2)]">
                    <td className="py-2.5 px-2">L. Okafor</td>
                    <td className="py-2.5 px-2">claude-sonnet-4-5</td>
                    <td className="py-2.5 px-2 text-right boa-num">12,450</td>
                    <td className="py-2.5 px-2 text-right boa-num">1,305</td>
                    <td className="py-2.5 px-2 text-right boa-num">4.5s</td>
                    <td className="py-2.5 px-2 text-[color:var(--boa-vote-yes)]">OK</td>
                    <td className="py-2.5 px-2 text-right boa-num">$0.04</td>
                  </tr>
                  <tr className="hover:bg-[color:var(--boa-paper-2)]">
                    <td className="py-2.5 px-2">M. Trent</td>
                    <td className="py-2.5 px-2">gpt-4-turbo</td>
                    <td className="py-2.5 px-2 text-right boa-num">12,450</td>
                    <td className="py-2.5 px-2 text-right boa-num">950</td>
                    <td className="py-2.5 px-2 text-right boa-num">3.2s</td>
                    <td className="py-2.5 px-2 text-[color:var(--boa-vote-yes)]">OK</td>
                    <td className="py-2.5 px-2 text-right boa-num">$0.15</td>
                  </tr>
                  <tr className="hover:bg-[color:var(--boa-paper-2)]">
                    <td className="py-2.5 px-2">N. Bellamy</td>
                    <td className="py-2.5 px-2">claude-sonnet-4-5</td>
                    <td className="py-2.5 px-2 text-right boa-num">12,450</td>
                    <td className="py-2.5 px-2 text-right boa-num">1,112</td>
                    <td className="py-2.5 px-2 text-right boa-num">4.0s</td>
                    <td className="py-2.5 px-2 text-[color:var(--boa-vote-yes)]">OK</td>
                    <td className="py-2.5 px-2 text-right boa-num">$0.04</td>
                  </tr>
                  <tr className="hover:bg-[color:var(--boa-paper-2)] bg-[color:rgba(245,241,234,0.4)]">
                    <td className="py-2.5 px-2">Master</td>
                    <td className="py-2.5 px-2">claude-opus-4-1</td>
                    <td className="py-2.5 px-2 text-right boa-num">21,962</td>
                    <td className="py-2.5 px-2 text-right boa-num">6,853</td>
                    <td className="py-2.5 px-2 text-right boa-num">12.5s</td>
                    <td className="py-2.5 px-2 text-[color:var(--boa-vote-yes)]">OK</td>
                    <td className="py-2.5 px-2 text-right boa-num">$0.38</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t border-[color:var(--boa-rule-strong)] font-bold text-[color:var(--boa-ink)]">
                    <td colSpan={2} className="py-3 px-2">TOTAL</td>
                    <td className="py-3 px-2 text-right boa-num">84,212</td>
                    <td className="py-3 px-2 text-right boa-num">12,640</td>
                    <td className="py-3 px-2 text-right boa-num">~34.2s</td>
                    <td className="py-3 px-2"></td>
                    <td className="py-3 px-2 text-right boa-num">$0.81</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

        </article>
      </div>
    </AppLayout>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-[color:var(--boa-brass)] text-lg font-serif">§</span>
      <h2 className="boa-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--boa-ink-3)] font-bold">
        {title}
      </h2>
    </div>
  );
}

function SectionDivider() {
  return (
    <div className="w-full h-px bg-[color:var(--boa-rule)] mb-16" />
  );
}
