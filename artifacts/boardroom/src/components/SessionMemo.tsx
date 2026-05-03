import type { SessionMemo as SessionMemoData } from "@workspace/api-client-react";
import { getMemoSections, type MemoSection } from "@workspace/api-zod";

// Templated, print-ready one-page board memo.
// Renders the same `MemoSection[]` structure that the server uses for PDF and
// Notion exports, so preview and exported deliverables cannot drift.
export function SessionMemo({ memo }: { memo: SessionMemoData }) {
  const sections = getMemoSections(memo as Parameters<typeof getMemoSections>[0]);

  return (
    <article
      className="boa max-w-[760px] mx-auto bg-white border boa-rule rounded-sm shadow-sm"
      style={{ background: "var(--boa-paper)", color: "var(--boa-ink)" }}
    >
      <div className="px-12 pt-12 pb-10">
        {sections.map((s, i) => (
          <SectionRenderer key={i} section={s} />
        ))}
      </div>
    </article>
  );
}

function SectionRenderer({ section }: { section: MemoSection }) {
  switch (section.kind) {
    case "header":
      return (
        <header className="pb-6 mb-8 border-b boa-rule-strong">
          <div
            className="boa-mono text-[10px] uppercase tracking-[0.22em] mb-3"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Minutes — Session #{section.sessionId.slice(0, 8)}  ·  {section.mode}
          </div>
          <h1
            className="boa-display text-[28px] leading-tight font-semibold mb-2"
            style={{ color: "var(--boa-ink)" }}
          >
            {section.boardName} — Board memo
          </h1>
          <p
            className="boa-display italic text-[16px] leading-snug"
            style={{ color: "var(--boa-ink-2)" }}
          >
            “{section.questionText}”
          </p>
        </header>
      );
    case "text":
      return (
        <Section label={section.label}>
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{section.body}</p>
        </Section>
      );
    case "voteTally":
      return (
        <Section label="Vote tally">
          <div className="flex items-center gap-6 mb-3">
            <Tally label="Yes" value={section.yes} color="var(--boa-vote-yes)" />
            <Tally label="No" value={section.no} color="var(--boa-vote-no)" />
            <Tally label="Abstain" value={section.abstain} color="var(--boa-vote-abs)" />
          </div>
          <ul className="text-[13px] leading-relaxed">
            {section.votes.map((v, i) => (
              <li key={i} className="flex justify-between border-b boa-rule py-1.5">
                <span>
                  {v.memberName ?? "Advisor"}
                  {v.memberRoleTitle && (
                    <span style={{ color: "var(--boa-ink-3)" }}> — {v.memberRoleTitle}</span>
                  )}
                </span>
                <span
                  className="boa-mono text-[10px] uppercase font-bold tracking-wider"
                  style={{ color: voteColor(v.vote) }}
                >
                  {v.vote ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      );
    case "footer":
      return (
        <footer className="mt-10 pt-5 border-t boa-rule-strong flex justify-between items-end">
          <div
            className="boa-display italic text-[14px]"
            style={{ color: "var(--boa-ink-2)" }}
          >
            Signed by the {section.boardName}.
          </div>
          <div
            className="boa-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            {section.date}
          </div>
        </footer>
      );
  }
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2
        className="boa-mono text-[10px] uppercase tracking-[0.22em] mb-2 pb-1 border-b boa-rule"
        style={{ color: "var(--boa-ink-3)" }}
      >
        {label}
      </h2>
      <div style={{ color: "var(--boa-ink-2)" }}>{children}</div>
    </section>
  );
}

function Tally({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="boa-display boa-num text-[28px]" style={{ color }}>
        {value}
      </span>
      <span
        className="boa-mono text-[10px] uppercase tracking-wider"
        style={{ color: "var(--boa-ink-3)" }}
      >
        {label}
      </span>
    </div>
  );
}

function voteColor(v: string | null | undefined): string {
  if (v === "YES") return "var(--boa-vote-yes)";
  if (v === "NO") return "var(--boa-vote-no)";
  if (v === "ABSTAIN") return "var(--boa-vote-abs)";
  return "var(--boa-ink-3)";
}
