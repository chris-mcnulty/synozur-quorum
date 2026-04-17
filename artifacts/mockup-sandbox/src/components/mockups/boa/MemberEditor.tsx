import React from "react";
import { AppLayout } from "./_shared/AppLayout";
import { Button } from "@/components/ui/button";
import { FileText, Replace, Trash2, Eye, Download, Info } from "lucide-react";

export function MemberEditor() {
  const crumbs = [
    { label: "Helix Capital" },
    { label: "Boards", href: "#" },
    { label: "Capital Allocation Council", href: "#" },
    { label: "Reema Chaudhuri" },
  ];

  const rightSlot = (
    <div className="flex items-center gap-3">
      <a href="#" className="text-[13px] hover:underline" style={{ color: "var(--boa-ink-3)" }}>
        Cancel
      </a>
      <Button className="boa-cta h-8 rounded-sm text-[13px] px-4 font-normal">
        Save member
      </Button>
    </div>
  );

  return (
    <AppLayout active="boards" tenant="Helix Capital" crumbs={crumbs} rightSlot={rightSlot}>
      <div className="max-w-[1120px] mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="boa-display text-3xl mb-2">Edit Member</h1>
          <div className="boa-mono text-[11px] text-[color:var(--boa-ink-3)] uppercase tracking-widest">
            ID: <span className="boa-num">MBR-8X9V2</span> · CREATED: <span className="boa-num">OCT 12, 2023</span>
          </div>
        </div>

        <div className="flex gap-12 items-start">
          {/* Left Column - Form Fields */}
          <div className="flex-1 w-[58%] max-w-[640px] flex flex-col">
            
            {/* 1. IDENTITY */}
            <FormSection title="Identity">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider boa-mono text-[color:var(--boa-ink-3)]">Name</label>
                    <input 
                      type="text" 
                      defaultValue="Reema Chaudhuri"
                      className="w-full bg-transparent border-b boa-rule-strong pb-1 text-[15px] focus:outline-none focus:border-[color:var(--boa-brass)] transition-colors placeholder:text-[color:var(--boa-ink-3)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider boa-mono text-[color:var(--boa-ink-3)]">Role Title</label>
                    <input 
                      type="text" 
                      defaultValue="Risk & Downside"
                      className="w-full bg-transparent border-b boa-rule-strong pb-1 text-[15px] focus:outline-none focus:border-[color:var(--boa-brass)] transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-wider boa-mono text-[color:var(--boa-ink-3)]">Avatar</label>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-1.5">
                      <div className="w-6 h-6 rounded-full border-2 border-[color:var(--boa-ink)] cursor-pointer" style={{ background: "var(--boa-vote-no)" }} />
                      <div className="w-6 h-6 rounded-full border border-transparent cursor-pointer opacity-70 hover:opacity-100" style={{ background: "var(--boa-vote-yes)" }} />
                      <div className="w-6 h-6 rounded-full border border-transparent cursor-pointer opacity-70 hover:opacity-100" style={{ background: "var(--boa-vote-abs)" }} />
                      <div className="w-6 h-6 rounded-full border border-transparent cursor-pointer opacity-70 hover:opacity-100" style={{ background: "var(--boa-aubergine)" }} />
                      <div className="w-6 h-6 rounded-full border border-transparent cursor-pointer opacity-70 hover:opacity-100 flex items-center justify-center text-[10px] boa-mono text-white" style={{ background: "var(--boa-ink-2)" }}>RC</div>
                      <div className="w-6 h-6 rounded-full border border-transparent cursor-pointer opacity-70 hover:opacity-100 flex items-center justify-center text-[10px] boa-mono text-[color:var(--boa-ink)]" style={{ background: "var(--boa-brass)" }}>RC</div>
                    </div>
                    <div className="w-[1px] h-4 bg-[color:var(--boa-rule)]" />
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" className="accent-[color:var(--boa-ink)]" defaultChecked />
                      <span className="text-[13px] text-[color:var(--boa-ink-2)] group-hover:text-[color:var(--boa-ink)]">Use initials</span>
                    </label>
                  </div>
                </div>
              </div>
            </FormSection>

            {/* 2. LENS */}
            <FormSection title="Lens">
              <div className="space-y-2">
                <input 
                  type="text" 
                  defaultValue="Asks who pays the price when the model is wrong."
                  className="w-full bg-transparent border-b boa-rule-strong pb-1 text-[15px] focus:outline-none focus:border-[color:var(--boa-brass)] transition-colors"
                />
                <div className="boa-mono italic text-[11px] text-[color:var(--boa-ink-3)]">
                  One sentence. This appears in the member's persona header.
                </div>
              </div>
            </FormSection>

            {/* 3. INSTRUCTIONS */}
            <FormSection title="Instructions">
              <div className="space-y-3">
                <div className="boa-surface rounded-sm border boa-rule p-4 shadow-sm relative">
                  <textarea 
                    className="w-full h-[340px] bg-transparent resize-none focus:outline-none text-[13px] leading-relaxed boa-mono"
                    defaultValue={`IDENTITY
You are Reema Chaudhuri, a specialist in tail-risk and downside protection. You have spent two decades managing portfolios through market crises and structural shifts.

ROLE ON THE BOARD
Your job is to identify what can go wrong. You are the counter-weight to optimism. You look for hidden leverage, unpriced externalities, and correlated failures.

CORE DECISION-MAKING PRINCIPLES
1. Survival precedes return.
2. Complex systems fail complexly.
3. Assume the worst case is worse than imagined.

RISK & TIME HORIZON
WHAT YOU OPTIMIZE FOR
WHAT YOU ARE SKEPTICAL OF
HOW YOU INTERROGATE A PROPOSAL
DISAGREEMENT PERMISSION
COMMUNICATION STYLE
BOUNDARIES
CHILD AGENT OPERATING CONTRACT`}
                  />
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className="boa-mono text-[10px] px-2 py-0.5 rounded-sm" style={{ background: "var(--boa-brass-tint)", color: "var(--boa-brass-2)" }}>
                      Above suggested length — consider trimming.
                    </span>
                    <span className="boa-mono text-[11px] text-[color:var(--boa-ink-3)]">
                      <span className="text-[color:var(--boa-ink)] font-medium boa-num">1,840</span> / ~1,500 suggested
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button className="text-[12px] underline underline-offset-4 decoration-[color:var(--boa-rule)] hover:decoration-[color:var(--boa-ink)] transition-colors text-[color:var(--boa-ink-3)] hover:text-[color:var(--boa-ink)]">
                    Restore skeleton template
                  </button>
                  <span className="boa-mono text-[10px] text-[color:var(--boa-ink-3)] uppercase tracking-wider">
                    Autosaved 2m ago
                  </span>
                </div>
              </div>
            </FormSection>

            {/* 4. MODEL OVERRIDE */}
            <FormSection title="Model Override" isLast>
              <div className="space-y-1.5">
                <div className="relative w-[280px]">
                  <select className="w-full appearance-none bg-transparent border-b boa-rule-strong pb-1 text-[14px] focus:outline-none focus:border-[color:var(--boa-brass)] transition-colors pr-6 cursor-pointer">
                    <option>claude-opus-4-1 (override)</option>
                    <option>claude-sonnet-4-5</option>
                    <option>gpt-4o</option>
                  </select>
                  <div className="absolute right-0 top-[2px] pointer-events-none">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
                <div className="boa-mono text-[10px] text-[color:var(--boa-ink-3)]">
                  Board default: claude-sonnet-4-5
                </div>
              </div>
            </FormSection>

          </div>

          {/* Right Column - Previews */}
          <div className="w-[42%] max-w-[420px] flex flex-col gap-6 sticky top-8">
            
            {/* Persona card preview */}
            <div className="space-y-2">
              <h3 className="boa-mono text-[11px] uppercase tracking-widest text-[color:var(--boa-ink-3)]">Persona Card Preview</h3>
              <div className="boa-surface rounded-sm p-5 border boa-rule">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] boa-mono text-white shrink-0 mt-1" style={{ background: "var(--boa-vote-no)" }}>
                    RC
                  </div>
                  <div>
                    <div className="boa-display text-xl leading-tight">Reema Chaudhuri</div>
                    <div className="italic text-[13px] text-[color:var(--boa-ink-2)] mt-0.5">Risk & Downside</div>
                    <div className="italic text-[12px] text-[color:var(--boa-ink-3)] mt-2 leading-snug">
                      Asks who pays the price when the model is wrong.
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t boa-rule">
                  <div className="text-[11px] uppercase tracking-wider boa-mono text-[color:var(--boa-ink-3)] mb-2">Sample Session Attribution</div>
                  <div className="text-[14px] font-medium">
                    Reema Chaudhuri — Risk & Downside
                  </div>
                </div>
              </div>
            </div>

            {/* Grounding document */}
            <div className="space-y-2">
              <h3 className="boa-mono text-[11px] uppercase tracking-widest text-[color:var(--boa-ink-3)]">Grounding Document</h3>
              <div className="border-2 border-dashed boa-rule rounded-sm bg-[color:var(--boa-paper-2)] p-4">
                
                <div className="flex items-start gap-3 bg-[color:var(--boa-paper)] p-3 rounded-sm border boa-rule shadow-sm">
                  <FileText className="w-5 h-5 text-[color:var(--boa-ink-3)] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium truncate">chaudhuri-risks.txt</span>
                      <span className="boa-mono text-[10px] text-[color:var(--boa-ink-3)]">24 KB</span>
                    </div>
                    <div className="boa-mono text-[10px] text-[color:var(--boa-ink-3)] mt-1.5 flex items-center gap-1.5">
                      <span className="boa-num">8,420</span> chars · well below 50,000 truncation limit
                    </div>
                    <div className="boa-mono text-[9px] text-[color:var(--boa-ink-3)] mt-1 uppercase tracking-wider">
                      Uploaded by Elena Marsh, 8 days ago
                    </div>
                    
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t boa-rule">
                      <button className="text-[11px] flex items-center gap-1.5 text-[color:var(--boa-ink-2)] hover:text-[color:var(--boa-ink)] transition-colors">
                        <Eye className="w-3 h-3" /> View
                      </button>
                      <button className="text-[11px] flex items-center gap-1.5 text-[color:var(--boa-ink-2)] hover:text-[color:var(--boa-ink)] transition-colors">
                        <Replace className="w-3 h-3" /> Replace
                      </button>
                      <button className="text-[11px] flex items-center gap-1.5 text-[color:var(--boa-vote-no)] hover:opacity-80 transition-colors ml-auto">
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-wider boa-mono text-[color:var(--boa-ink-3)] mb-1.5 ml-1">Extracted Text Preview</div>
                  <div className="h-24 overflow-y-auto border boa-rule bg-[color:var(--boa-paper)] rounded-sm p-2.5 text-[11px] boa-mono text-[color:var(--boa-ink-2)] leading-relaxed opacity-80">
                    Framework for Downside Protection:
                    1. Asymmetry Identification
                    Look for trades where the maximum loss is defined but the upside is unbound.
                    Conversely, veto any structure where upside is capped but downside is catastrophic.
                    2. Liquidity Premium
                    Never assume liquidity in a crisis. Model the exit cost at 5x normal spreads.
                    ...
                  </div>
                </div>
              </div>
            </div>

            {/* Boundaries Reminder */}
            <div className="rounded-sm p-3 border border-[color:var(--boa-brass)] bg-[color:var(--boa-brass-tint)] flex gap-2.5 mt-2">
              <Info className="w-4 h-4 text-[color:var(--boa-brass)] shrink-0 mt-0.5" />
              <p className="text-[12px] leading-relaxed text-[color:var(--boa-ink)]">
                <strong className="font-medium">Boundaries reminder:</strong> This member must not reference other members or attempt to synthesize. Boundary text is enforced in instructions.
              </p>
            </div>

          </div>
        </div>

      </div>
    </AppLayout>
  );
}

function FormSection({ title, children, isLast = false }: { title: string, children: React.ReactNode, isLast?: boolean }) {
  return (
    <div className={`flex gap-6 py-8 ${!isLast ? 'border-b boa-rule' : ''}`}>
      <div className="w-[140px] shrink-0">
        <h2 className="boa-mono text-[11px] uppercase tracking-widest text-[color:var(--boa-ink-3)]">{title}</h2>
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
