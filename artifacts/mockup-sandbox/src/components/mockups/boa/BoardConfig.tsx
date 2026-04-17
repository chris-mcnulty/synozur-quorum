import React, { useState } from "react";
import { AppLayout } from "./_shared/AppLayout";
import {
  GripVertical,
  FileText,
  AlertTriangle,
  FileWarning,
  Clock,
  ChevronRight,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function BoardConfig() {
  const [activeTab, setActiveTab] = useState("master");

  const crumbs = [
    { label: "Helix Capital" },
    { label: "Boards", href: "#" },
    { label: "Capital Allocation Council" },
  ];

  const rightSlot = (
    <div className="flex items-center gap-2">
      <Button variant="outline" className="h-8 text-[13px]">
        Save draft
      </Button>
      <Button className="h-8 text-[13px] boa-cta-brass">
        Convene session
      </Button>
    </div>
  );

  return (
    <AppLayout active="boards" tenant="Helix Capital" crumbs={crumbs} rightSlot={rightSlot}>
      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Masthead */}
        <div className="mb-8">
          <div className="mb-4">
            <span
              className="boa-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm"
              style={{ background: "rgba(184, 137, 58, 0.1)", color: "var(--boa-brass)" }}
            >
              FINANCE
            </span>
          </div>
          <h1 className="boa-display text-4xl mb-2">Capital Allocation Council</h1>
          <p className="text-[15px] italic mb-4" style={{ color: "var(--boa-ink-3)" }}>
            Convened to weigh capital deployment between competing initiatives.
          </p>
          <div
            className="flex flex-wrap items-center gap-3 boa-mono text-[11px]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            <span>Size: 7 voices</span>
            <span className="text-[10px]">•</span>
            <span>Created Mar 14, 2026</span>
            <span className="text-[10px]">•</span>
            <span>64 sessions</span>
            <span className="text-[10px]">•</span>
            <span>default master model: claude-opus-4-1</span>
            <span className="text-[10px]">•</span>
            <span>default member model: claude-sonnet-4-5</span>
            <span className="text-[10px]">•</span>
            <span>temperature 0.7</span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b boa-rule mb-6">
            <TabsList className="bg-transparent h-auto p-0 flex gap-6">
              {["general", "master", "members", "models", "permissions"].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className={`
                    bg-transparent p-0 pb-3 rounded-none border-b-2 border-transparent 
                    text-[13px] font-normal data-[state=active]:shadow-none
                    data-[state=active]:bg-transparent data-[state=active]:border-b-2 
                  `}
                  style={
                    activeTab === tab
                      ? { color: "var(--boa-ink)", borderColor: "var(--boa-brass)" }
                      : { color: "var(--boa-ink-3)" }
                  }
                >
                  {tab === "general" && "General"}
                  {tab === "master" && "Master Instructions"}
                  {tab === "members" && "Members"}
                  {tab === "models" && "Models & Temperature"}
                  {tab === "permissions" && "Permissions"}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="master" className="mt-0 outline-none">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left Column (62%) */}
              <div className="lg:w-[62%] flex flex-col min-w-0">
                <div className="boa-surface rounded-sm flex flex-col">
                  {/* Editor Surface */}
                  <div className="p-8 pb-12 min-h-[500px] text-[14px] leading-relaxed relative">
                    <p className="mb-6">
                      You are the Orchestrator of the Capital Allocation Council. Your purpose is to
                      guide a board of seven specialized advisors to rigorously evaluate capital
                      deployment opportunities across the portfolio. You do not generate ideas; you
                      stress-test them.
                    </p>

                    <h3 className="boa-mono text-[11px] uppercase tracking-widest mt-8 mb-3" style={{ color: "var(--boa-ink-3)" }}>
                      ROLE
                    </h3>
                    <p className="mb-6">
                      Maintain strict neutrality. Ensure all dimensions—risk, strategy, operations,
                      and ethics—are thoroughly debated before a formal vote is called. Do not let
                      strong personalities dominate the discourse. Ensure the Devil's Advocate is
                      always heard on consensus points.
                    </p>

                    <h3 className="boa-mono text-[11px] uppercase tracking-widest mt-8 mb-3" style={{ color: "var(--boa-ink-3)" }}>
                      MODE SELECTION
                    </h3>
                    <p className="mb-6">
                      Operate in three distinct modes based on the user's prompt:
                      <br />
                      <strong>ADVISORY:</strong> Exploratory debate to widen the aperture of possibilities. No formal voting.
                      <br />
                      <strong>BOARD:</strong> Structured deliberation concluding with a formal yea/nay/abstain vote from every member.
                      <br />
                      <strong>REVIEW:</strong> Post-mortem analysis of previous capital decisions compared to actual outcomes.
                    </p>

                    <h3 className="boa-mono text-[11px] uppercase tracking-widest mt-8 mb-3" style={{ color: "var(--boa-ink-3)" }}>
                      GLOBAL PRINCIPLES
                    </h3>
                    <p className="mb-6">
                      Demand hard data. If a member makes a claim without grounding it in their
                      provided context documents, call them out. Force quantitative comparisons
                      where qualitative language is used.
                    </p>

                    <h3 className="boa-mono text-[11px] uppercase tracking-widest mt-8 mb-3" style={{ color: "var(--boa-ink-3)" }}>
                      ROUTING FOR ANALYSIS
                    </h3>
                    <p className="mb-6">
                      Direct specific queries to the most relevant expert. Route financial downside
                      scenarios to Risk & Downside. Route timeline viability to the Operating Realist.
                    </p>
                  </div>

                  {/* Editor Footer */}
                  <div
                    className="border-t py-3 px-4 flex items-center justify-between"
                    style={{ borderColor: "var(--boa-paper-3)", background: "var(--boa-paper)" }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="boa-mono text-[11px]" style={{ color: "var(--boa-ink-3)" }}>
                        6,842 / ~7,500 recommended
                      </span>
                      <button
                        className="text-[12px] underline underline-offset-4"
                        style={{ color: "var(--boa-ink-3)" }}
                      >
                        Restore default template
                      </button>
                    </div>
                    <div className="boa-mono text-[11px]" style={{ color: "var(--boa-ink-3)" }}>
                      Saved 12s ago
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (38%) */}
              <div className="lg:w-[38%] flex flex-col gap-6">
                
                {/* Panel 1: Members */}
                <div>
                  <h3 className="text-[13px] font-medium mb-3" style={{ color: "var(--boa-ink-2)" }}>
                    Members on this board
                  </h3>
                  <div className="border border-b-0 rounded-sm overflow-hidden boa-rule">
                    {[
                      {
                        name: "Margot Hale",
                        role: "Capital Allocator",
                        initials: "MH",
                        color: "#2b4b6f",
                        model: "claude-sonnet-4-5",
                        doc: "hale-allocation-memo.pdf",
                        chars: "1,420 chars",
                      },
                      {
                        name: "Idris Saito",
                        role: "Operating Realist",
                        initials: "IS",
                        color: "#5a4b3c",
                        model: "claude-sonnet-4-5",
                        doc: "saito-ops-playbook.docx",
                        chars: "1,612 chars",
                      },
                      {
                        name: "Reema Chaudhuri",
                        role: "Risk & Downside",
                        initials: "RC",
                        color: "#6b3c3c",
                        model: "claude-opus-4-1",
                        override: true,
                        doc: "chaudhuri-risks.txt",
                        chars: "1,840 chars",
                      },
                      {
                        name: "Tomas Brandt",
                        role: "Long-Horizon Strategist",
                        initials: "TB",
                        color: "#3c6b5d",
                        model: "claude-sonnet-4-5",
                        doc: "brandt-strategy.md",
                        chars: "1,310 chars",
                      },
                      {
                        name: "Yael Aronoff",
                        role: "Customer Voice",
                        initials: "YA",
                        color: "#5b3c6b",
                        model: "claude-sonnet-4-5",
                        doc: "aronoff-voc-q1.pdf",
                        chars: "1,255 chars",
                      },
                      {
                        name: "Kenji Park",
                        role: "Devil's Advocate",
                        initials: "KP",
                        color: "#6b543c",
                        model: "claude-sonnet-4-5",
                        doc: null,
                        chars: "980 chars",
                      },
                      {
                        name: "Adaeze Okonkwo",
                        role: "Ethics & Stakeholder",
                        initials: "AO",
                        color: "#3c506b",
                        model: "claude-sonnet-4-5",
                        doc: "okonkwo-frameworks.pdf",
                        chars: "1,495 chars",
                      },
                    ].map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 border-b boa-rule bg-white hover:bg-gray-50/50"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical
                            className="w-4 h-4 cursor-grab"
                            style={{ color: "var(--boa-paper-3)" }}
                          />
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-medium"
                            style={{ backgroundColor: m.color }}
                          >
                            {m.initials}
                          </div>
                          <div>
                            <div className="boa-display text-[15px] leading-tight mb-0.5">{m.name}</div>
                            <div className="text-[11px] italic" style={{ color: "var(--boa-ink-3)" }}>
                              {m.role}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-right">
                          <div className="flex items-center gap-1.5">
                            {m.override && (
                              <span className="boa-mono text-[9px] px-1 py-0.5 rounded-sm bg-gray-100 text-gray-500">
                                override
                              </span>
                            )}
                            <span className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
                              {m.model}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {m.doc ? (
                              <div className="flex items-center gap-1 boa-mono text-[10px]" style={{ color: "var(--boa-ink-2)" }}>
                                <FileText className="w-3 h-3" />
                                {m.doc}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[10px] text-amber-700">
                                <FileWarning className="w-3 h-3" />
                                no document
                              </div>
                            )}
                            <span className="boa-mono text-[10px] ml-1" style={{ color: "var(--boa-ink-3)" }}>
                              ({m.chars})
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Button variant="outline" disabled className="h-8 text-[12px] bg-transparent border-dashed">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add member
                    </Button>
                    <span className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
                      7 of 7 voices — odd-number rule met
                    </span>
                  </div>
                </div>

                {/* Panel 2: Recent sessions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-medium" style={{ color: "var(--boa-ink-2)" }}>
                      Recent sessions
                    </h3>
                    <a href="#" className="text-[11px] underline underline-offset-2" style={{ color: "var(--boa-ink-3)" }}>View all</a>
                  </div>
                  <div className="border rounded-sm boa-rule bg-white">
                    {[
                      {
                        title: "Q3 Headcount Expansion vs Dividend",
                        mode: "BOARD",
                        date: "Oct 12",
                        result: "Approved (5-2)",
                      },
                      {
                        title: "Project Titan M&A Evaluation",
                        mode: "ADVISORY",
                        date: "Sep 28",
                        result: "Explored 4 paths",
                      },
                      {
                        title: "Review: FY25 R&D Allocation",
                        mode: "REVIEW",
                        date: "Sep 15",
                        result: "Identified $2M waste",
                      },
                      {
                        title: "European Market Entry Timing",
                        mode: "BOARD",
                        date: "Aug 04",
                        result: "Rejected (2-5)",
                      },
                    ].map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 border-b last:border-0 boa-rule"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="text-[13px] truncate font-medium mb-0.5">{s.title}</div>
                          <div className="flex items-center gap-2 boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
                            <span>{s.mode}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{s.date}</span>
                          </div>
                        </div>
                        <div className="text-[11px] whitespace-nowrap" style={{ color: "var(--boa-ink-3)" }}>
                          {s.result}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Panel 3: Hazards */}
                <div>
                  <h3 className="text-[13px] font-medium mb-3 flex items-center gap-2" style={{ color: "var(--boa-ink-2)" }}>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Hazards
                  </h3>
                  <div className="border rounded-sm boa-rule p-3 bg-amber-50/30">
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-[12px] leading-snug">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: "var(--boa-brass)" }} />
                        <span>1 member (Kenji Park) without grounding document. Responses may drift.</span>
                      </li>
                      <li className="flex items-start gap-2 text-[12px] leading-snug">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: "var(--boa-brass)" }} />
                        <span>Master instructions reference 'temperature' but board temp is set to default (0.7).</span>
                      </li>
                    </ul>
                  </div>
                </div>

              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="general">
            <div className="p-8 text-sm" style={{ color: "var(--boa-ink-3)" }}>General configuration goes here.</div>
          </TabsContent>
          <TabsContent value="members">
            <div className="p-8 text-sm" style={{ color: "var(--boa-ink-3)" }}>Detailed members view goes here.</div>
          </TabsContent>
          <TabsContent value="models">
            <div className="p-8 text-sm" style={{ color: "var(--boa-ink-3)" }}>Models & Temperature settings go here.</div>
          </TabsContent>
          <TabsContent value="permissions">
            <div className="p-8 text-sm" style={{ color: "var(--boa-ink-3)" }}>Permissions configuration goes here.</div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
