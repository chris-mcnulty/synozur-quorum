import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="boa min-h-[100dvh] flex flex-col items-center justify-center px-8"
      style={{ background: "var(--boa-paper)" }}
    >
      <div className="max-w-md w-full text-center flex flex-col items-center gap-6">
        <div
          className="boa-mono text-[80px] font-bold leading-none"
          style={{ color: "var(--boa-paper-3)" }}
        >
          404
        </div>

        <div>
          <h1
            className="boa-display text-[28px] mb-3"
            style={{ color: "var(--boa-ink)" }}
          >
            Page not found
          </h1>
          <p
            className="text-[14px] leading-relaxed max-w-xs mx-auto"
            style={{ color: "var(--boa-ink-3)" }}
          >
            The page you requested doesn't exist or may have been moved.
          </p>
        </div>

        <Link
          href="/"
          className="boa-mono text-[11px] uppercase tracking-[0.18em] px-5 py-2.5 border rounded-sm inline-flex items-center gap-2 hover:opacity-70 transition-opacity"
          style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>

        <div
          className="w-12 h-[1px] mt-2"
          style={{ background: "var(--boa-brass)" }}
        />
        <p
          className="boa-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Quorum — Board of Advisors
        </p>
      </div>
    </div>
  );
}
