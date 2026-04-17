import React, { useState } from "react";
import { AppLayout } from "./_shared/AppLayout";
import { LayoutGrid, List, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const BOARDS = [
  {
    id: "b-01",
    topic: "FINANCE",
    name: "Capital Allocation Council",
    description: "Evaluates major capital deployments, M&A targets, and dividend strategies.",
    members: ["MH", "IS", "RC", "AT", "BL", "DW", "EK"],
    lastSession: "2h ago",
    sessions: 64,
    status: "active",
  },
  {
    id: "b-02",
    topic: "MARKETING",
    name: "Brand & Story",
    description: "Reviews public narratives, crisis communications, and brand equity.",
    members: ["MH", "IS", "RC", "AT", "BL"],
    lastSession: "yesterday",
    sessions: 31,
    status: "active",
  },
  {
    id: "b-03",
    topic: "OPERATIONS",
    name: "Operating Cadence",
    description: "Focuses on supply chain resilience, internal processes, and OKR reviews.",
    members: ["IS", "RC", "BL", "DW", "EK"],
    lastSession: "4d ago",
    sessions: 22,
    status: "active",
  },
  {
    id: "b-04",
    topic: "PRODUCT",
    name: "Product Direction",
    description: "Aligns engineering roadmaps with market realities and technical debt.",
    members: ["AT", "BL", "DW", "EK", "MH"],
    lastSession: "6d ago",
    sessions: 18,
    status: "active",
  },
  {
    id: "b-05",
    topic: "PEOPLE",
    name: "Hiring & People",
    description: "Deliberates on executive compensation, culture shifts, and restructuring.",
    members: ["RC", "AT", "BL"],
    lastSession: "12d ago",
    sessions: 9,
    status: "active",
  },
  {
    id: "b-06",
    topic: "GENERAL STRATEGY",
    name: "Geopolitical Risk",
    description: "Assesses macroeconomic shifts, regulatory threats, and global events.",
    members: ["MH", "IS", "RC", "EK"],
    targetMembers: 7,
    lastSession: "never",
    sessions: 0,
    status: "draft",
  },
];

const FILTERS = [
  "All",
  "General Strategy",
  "Marketing",
  "Operations",
  "Finance",
  "Product",
  "People",
];

export function Boards() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  return (
    <AppLayout
      active="boards"
      tenant="Helix Capital"
      crumbs={[{ label: "Helix Capital" }, { label: "Boards" }]}
      rightSlot={
        <button className="boa-cta-brass h-8 px-4 text-[13px] rounded-sm flex items-center gap-2 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Convene new board
        </button>
      }
    >
      <div className="max-w-[1200px] mx-auto p-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="boa-display text-4xl mb-2 text-[color:var(--boa-ink)] tracking-tight">Boards</h1>
            <p className="text-[14px] text-[color:var(--boa-ink-3)]">
              Six councils. Each meets only when summoned.
            </p>
          </div>
          <div className="flex flex-col items-end gap-4">
            <div className="flex items-center gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1 text-[12px] rounded-full transition-colors ${
                    activeFilter === f
                      ? "bg-[color:var(--boa-ink)] text-[color:var(--boa-paper)]"
                      : "text-[color:var(--boa-ink-3)] hover:bg-[rgba(20,20,26,0.04)]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center p-0.5 rounded-sm border boa-rule bg-[color:var(--boa-paper-2)]">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1 rounded-sm ${
                  viewMode === "grid"
                    ? "bg-[color:var(--boa-paper)] shadow-sm"
                    : "text-[color:var(--boa-ink-3)]"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1 rounded-sm ${
                  viewMode === "table"
                    ? "bg-[color:var(--boa-paper)] shadow-sm"
                    : "text-[color:var(--boa-ink-3)]"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {BOARDS.map((board) => (
            <div
              key={board.id}
              className={`boa-surface flex flex-col rounded-sm relative ${
                board.status === "draft" ? "border-l-2" : ""
              }`}
              style={{
                height: "260px",
                borderLeftColor: board.status === "draft" ? "var(--boa-brass)" : undefined,
              }}
            >
              {board.status === "draft" && (
                <div
                  className="absolute top-0 left-0 w-full h-[3px]"
                  style={{ background: "var(--boa-brass)" }}
                />
              )}
              
              <div className="flex-1 p-5 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <span className="boa-mono text-[10px] tracking-widest uppercase text-[color:var(--boa-ink-3)]">
                    {board.topic}
                  </span>
                  {board.status === "draft" && (
                    <span
                      className="boa-mono text-[10px] px-1.5 py-0.5 rounded-sm uppercase tracking-widest"
                      style={{
                        background: "rgba(184, 137, 58, 0.1)",
                        color: "var(--boa-brass)",
                      }}
                    >
                      DRAFT — {board.members.length} of {board.targetMembers} defined
                    </span>
                  )}
                </div>
                
                <h3 className="boa-display text-2xl leading-tight mb-2 text-[color:var(--boa-ink)]">
                  {board.name}
                </h3>
                
                <p className="italic text-[13px] text-[color:var(--boa-ink-3)] leading-relaxed mb-auto line-clamp-2">
                  {board.description}
                </p>

                <div className="mt-4 flex items-center">
                  <div className="flex -space-x-1.5">
                    {board.members.slice(0, 5).map((m, i) => (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full border-2 flex items-center justify-center boa-mono text-[9px] bg-[color:var(--boa-paper)] border-[color:var(--boa-paper)] text-[color:var(--boa-ink)]"
                        style={{ zIndex: 10 - i, borderStyle: "solid", borderColor: "#fbf8f1" }}
                      >
                        <div className="w-full h-full rounded-full flex items-center justify-center bg-[rgba(20,20,26,0.06)]">
                          {m}
                        </div>
                      </div>
                    ))}
                    {board.members.length > 5 && (
                      <div
                        className="w-7 h-7 rounded-full border-2 flex items-center justify-center boa-mono text-[9px] bg-[color:var(--boa-paper-2)] border-[color:var(--boa-paper)] text-[color:var(--boa-ink-3)]"
                        style={{ zIndex: 0, borderStyle: "solid", borderColor: "#fbf8f1" }}
                      >
                        +{board.members.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Footer Row */}
              <div className="px-5 pb-4 pt-1 flex items-center justify-between boa-mono text-[10px] text-[color:var(--boa-ink-3)] uppercase tracking-wider">
                <span>
                  {board.status === "draft" ? "— voices" : `${board.members.length} voices`}
                </span>
                <span>Session: {board.lastSession}</span>
                <span>{board.sessions} total</span>
              </div>

              {/* Bottom Action Row */}
              <div className="border-t boa-rule h-[44px] flex items-stretch text-[13px]">
                <button className="flex-1 flex items-center justify-center hover:bg-[rgba(20,20,26,0.02)] transition-colors border-r boa-rule font-medium text-[color:var(--boa-ink-2)]">
                  Open
                </button>
                <button className="flex-1 flex items-center justify-center hover:bg-[rgba(20,20,26,0.02)] transition-colors font-medium text-[color:var(--boa-ink)]">
                  Convene
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Archived */}
        <div className="border-t boa-rule pt-6">
          <button className="flex items-center gap-2 text-[13px] text-[color:var(--boa-ink-3)] hover:text-[color:var(--boa-ink)] transition-colors">
            <ChevronDown className="w-4 h-4" />
            <span className="font-medium">Archived (1)</span>
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
