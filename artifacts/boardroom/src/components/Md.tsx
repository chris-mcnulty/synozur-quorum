import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CSSProperties, ReactNode } from "react";
import type { CitationTarget } from "@/lib/citations";
import { scrollToCitation } from "@/lib/citations";

interface MdProps {
  children: string;
  className?: string;
  style?: CSSProperties;
}

function sharedComponents(colorStyle: CSSProperties) {
  return {
    h1: ({ children }: { children?: ReactNode }) => (
      <h2
        className="boa-display text-[20px] font-semibold mb-3 mt-5 first:mt-0"
        style={{ color: "var(--boa-ink)" }}
      >
        {children}
      </h2>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h3
        className="boa-display text-[17px] font-semibold mb-2 mt-4 first:mt-0"
        style={{ color: "var(--boa-ink)" }}
      >
        {children}
      </h3>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h4
        className="text-[15px] font-semibold mb-2 mt-3 first:mt-0"
        style={{ color: "var(--boa-ink)" }}
      >
        {children}
      </h4>
    ),
    p: ({ children }: { children?: ReactNode }) => (
      <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
    ),
    li: ({ children }: { children?: ReactNode }) => (
      <li className="leading-relaxed">{children}</li>
    ),
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="font-semibold" style={{ color: "var(--boa-ink)" }}>
        {children}
      </strong>
    ),
    em: ({ children }: { children?: ReactNode }) => (
      <em className="italic">{children}</em>
    ),
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote
        className="border-l-2 pl-4 my-3 italic"
        style={{ borderColor: "var(--boa-brass)", ...colorStyle }}
      >
        {children}
      </blockquote>
    ),
    code: ({
      inline,
      children,
    }: {
      inline?: boolean;
      children?: ReactNode;
    }) =>
      inline ? (
        <code
          className="boa-mono text-[12px] px-1.5 py-0.5 rounded-sm"
          style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink)" }}
        >
          {children}
        </code>
      ) : (
        <pre
          className="boa-mono text-[12px] rounded-sm p-3 overflow-x-auto mb-3"
          style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink)" }}
        >
          <code>{children}</code>
        </pre>
      ),
    hr: () => (
      <hr
        className="my-4 border-0 border-t"
        style={{ borderColor: "var(--boa-paper-3)" }}
      />
    ),
    a: ({ href, children }: { href?: string; children?: ReactNode }) => (
      <a
        href={href}
        className="underline hover:opacity-70"
        style={{ color: "var(--boa-brass)" }}
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </a>
    ),
  };
}

export function Md({ children, className, style }: MdProps) {
  const colorStyle: CSSProperties = style ?? { color: "var(--boa-ink-2)" };
  return (
    <div className={`text-[15px] max-w-3xl ${className ?? ""}`} style={colorStyle}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedComponents(colorStyle)}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

interface MdWithCitationsProps {
  children: string;
  citationTargets: Map<string, CitationTarget>;
  className?: string;
  style?: CSSProperties;
}

export function MdWithCitations({
  children,
  citationTargets,
  className,
  style,
}: MdWithCitationsProps) {
  const colorStyle: CSSProperties = style ?? { color: "var(--boa-ink-2)" };

  const processed = children.replace(
    /\[grounded:([^\]]+)\]/g,
    (_, id: string) => `[grounded](grounded:${id.trim()})`,
  );

  const citationLink = ({
    href,
    children: label,
  }: {
    href?: string;
    children?: ReactNode;
  }) => {
    if (href?.startsWith("grounded:")) {
      const id = href.slice("grounded:".length);
      const target = citationTargets.get(id);
      if (target) {
        return (
          <button
            type="button"
            onClick={() => scrollToCitation(target.anchorId)}
            className="inline-flex items-baseline align-baseline boa-mono text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 mx-0.5 rounded-sm hover:underline"
            style={{
              background: "rgba(184,134,11,0.12)",
              color: "var(--boa-brass)",
              border: "1px solid rgba(184,134,11,0.3)",
            }}
            title={`Jump to snapshot: ${target.label}`}
          >
            {target.label}
          </button>
        );
      }
      const short = id.length > 10 ? `${id.slice(0, 8)}…` : id;
      return (
        <span
          className="boa-mono text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 mx-0.5 rounded-sm"
          style={{
            background: "rgba(196,106,42,0.12)",
            color: "var(--boa-flag)",
            border: "1px solid rgba(196,106,42,0.3)",
          }}
          title={`Citation id ${id} did not match any snapshot`}
        >
          ?{short}
        </span>
      );
    }
    return (
      <a
        href={href}
        className="underline hover:opacity-70"
        style={{ color: "var(--boa-brass)" }}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
    );
  };

  const components = {
    ...sharedComponents(colorStyle),
    a: citationLink,
  };

  return (
    <div className={`text-[15px] max-w-3xl ${className ?? ""}`} style={colorStyle}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components as Parameters<typeof ReactMarkdown>[0]["components"]}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}
