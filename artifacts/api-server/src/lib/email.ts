import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

let cachedTransporter: Transporter | null = null;
let cacheKey: string | null = null;

function buildTransporter(): Transporter | null {
  const url = process.env.SMTP_URL;
  if (url) {
    if (cacheKey === url && cachedTransporter) return cachedTransporter;
    cachedTransporter = nodemailer.createTransport(url);
    cacheKey = url;
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const key = `${host}:${port}:${user ?? ""}`;
  if (cacheKey === key && cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  cacheKey = key;
  return cachedTransporter;
}

export interface SendDigestArgs {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

export async function sendDigestEmail(
  args: SendDigestArgs,
): Promise<{ delivered: boolean; status: string }> {
  if (args.to.length === 0) {
    return { delivered: false, status: "no_recipients" };
  }
  const transporter = buildTransporter();
  if (!transporter) {
    logger.warn(
      { recipientCount: args.to.length },
      "SMTP not configured; digest email skipped",
    );
    return { delivered: false, status: "skipped_no_smtp" };
  }
  const from =
    process.env.SMTP_FROM ?? "Quorum Cadence <noreply@quorum.local>";
  try {
    await transporter.sendMail({
      from,
      to: args.to.join(", "),
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    return { delivered: true, status: "sent" };
  } catch (err) {
    logger.error({ err }, "Digest email send failed");
    return { delivered: false, status: "send_failed" };
  }
}

export function renderDigestHtml(args: {
  boardName: string;
  cadenceName: string;
  question: string;
  convergenceNote: string;
  finalSummary: string;
  voteSummary: string | null;
  sessionLink: string;
}): { text: string; html: string } {
  const text = [
    `${args.cadenceName} — ${args.boardName}`,
    "",
    `Question: ${args.question}`,
    "",
    "── Convergence ──",
    args.convergenceNote || "(no convergence note)",
    "",
    args.voteSummary ? `── Votes ──\n${args.voteSummary}\n` : "",
    "── Executive Summary ──",
    args.finalSummary || "(no summary)",
    "",
    `Full minutes: ${args.sessionLink}`,
  ]
    .filter(Boolean)
    .join("\n");

  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const html = `
<div style="font-family:Georgia,serif;color:#1a1a1a;max-width:640px;margin:0 auto;padding:32px 24px;background:#faf7f1;">
  <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6a2c;margin-bottom:8px;">
    ${escape(args.cadenceName)} · ${escape(args.boardName)}
  </div>
  <h1 style="font-size:22px;margin:0 0 16px;font-weight:500;color:#1a1a1a;">${escape(args.question)}</h1>
  <hr style="border:none;border-top:1px solid #d8c9a3;margin:20px 0;"/>
  <h2 style="font-size:13px;font-family:'IBM Plex Mono',monospace;letter-spacing:0.18em;text-transform:uppercase;color:#5a4a2c;">Convergence</h2>
  <div style="white-space:pre-wrap;font-size:14px;line-height:1.55;">${escape(args.convergenceNote || "(no convergence note)")}</div>
  ${
    args.voteSummary
      ? `<h2 style="font-size:13px;font-family:'IBM Plex Mono',monospace;letter-spacing:0.18em;text-transform:uppercase;color:#5a4a2c;margin-top:24px;">Votes</h2>
         <pre style="white-space:pre-wrap;font-size:13px;line-height:1.5;background:#f3ecdc;padding:12px;border-radius:2px;">${escape(args.voteSummary)}</pre>`
      : ""
  }
  <h2 style="font-size:13px;font-family:'IBM Plex Mono',monospace;letter-spacing:0.18em;text-transform:uppercase;color:#5a4a2c;margin-top:24px;">Executive summary</h2>
  <div style="white-space:pre-wrap;font-size:14px;line-height:1.55;">${escape(args.finalSummary || "(no summary)")}</div>
  <hr style="border:none;border-top:1px solid #d8c9a3;margin:24px 0;"/>
  <a href="${args.sessionLink}" style="display:inline-block;padding:10px 16px;background:#8a6a2c;color:#faf7f1;text-decoration:none;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;border-radius:2px;">View full minutes</a>
</div>`;

  return { text, html };
}
