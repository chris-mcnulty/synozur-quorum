import { getOpenAI } from "./openai";
import type { Logger } from "pino";

export type SpeakerRole = "chair" | "primary" | "dissenter" | "narrator";

export interface ScriptLine {
  speaker: SpeakerRole;
  voice: string;
  text: string;
  sectionKey?: string;
  sectionLabel?: string;
}

export interface ComposedScript {
  lines: ScriptLine[];
  voicesUsed: string[];
  estimatedSeconds: number;
}

const VOICE_MAP: Record<SpeakerRole, string> = {
  chair: "onyx",
  primary: "nova",
  dissenter: "fable",
  narrator: "alloy",
};

const TARGET_MIN_SECONDS = 180;
const TARGET_MAX_SECONDS = 420;
const WORDS_PER_SECOND = 2.6;

function abbreviate(text: string, maxWords: number): string {
  const words = (text || "").split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ") + "…";
}

function pickPrimaryAndDissenter(
  contributions: Array<{
    memberName: string | null;
    memberRoleTitle: string | null;
    contributionText: string | null;
    vote: string | null;
  }>,
): {
  primary?: typeof contributions[number];
  dissenter?: typeof contributions[number];
} {
  if (contributions.length === 0) return {};
  const yes = contributions.filter((c) => c.vote === "YES");
  const no = contributions.filter((c) => c.vote === "NO");
  // Primary: longest YES (or longest if no votes)
  const byLen = (a: typeof contributions[number], b: typeof contributions[number]) =>
    (b.contributionText?.length ?? 0) - (a.contributionText?.length ?? 0);
  const primaryPool = yes.length > 0 ? yes : [...contributions];
  const primary = [...primaryPool].sort(byLen)[0];
  // Dissenter: longest NO; otherwise the contribution most different from primary
  let dissenter: typeof contributions[number] | undefined;
  if (no.length > 0) {
    dissenter = [...no].sort(byLen)[0];
  } else {
    const remaining = contributions.filter((c) => c !== primary);
    dissenter = remaining.sort(byLen)[0];
  }
  return { primary, dissenter };
}

export interface ComposeInput {
  questionText: string;
  boardName: string;
  mode: string;
  chairsFraming: string | null;
  convergenceNote: string | null;
  contributions: Array<{
    memberName: string | null;
    memberRoleTitle: string | null;
    contributionText: string | null;
    vote: string | null;
  }>;
}

export function composeScript(input: ComposeInput): ComposedScript {
  const { primary, dissenter } = pickPrimaryAndDissenter(input.contributions);

  // Aim for ~5min ≈ 780 words. Distribute roughly: intro 60, framing 120,
  // primary 220, dissenter 200, convergence 140, outro 40.
  const lines: ScriptLine[] = [];

  const introWordCap = 70;
  const framingCap = 130;
  const primaryCap = 240;
  const dissenterCap = 220;
  const convergenceCap = 160;

  // Intro / Narrator handoff to Chair
  lines.push({
    speaker: "narrator",
    voice: VOICE_MAP.narrator,
    sectionKey: "intro",
    sectionLabel: "Intro",
    text: abbreviate(
      `Quorum minutes for the ${input.boardName} board. ${input.mode} session on the question: ${input.questionText}`,
      introWordCap,
    ),
  });

  // Chair framing
  if (input.chairsFraming) {
    lines.push({
      speaker: "chair",
      voice: VOICE_MAP.chair,
      sectionKey: "framing",
      sectionLabel: "Chair's framing",
      text:
        "As Chair, here is how I framed this for the council. " +
        abbreviate(input.chairsFraming, framingCap),
    });
  }

  // Primary advisor
  if (primary && primary.contributionText) {
    const role = primary.memberRoleTitle || "advisor";
    const name = primary.memberName || "Advisor";
    lines.push({
      speaker: "primary",
      voice: VOICE_MAP.primary,
      sectionKey: "primary",
      sectionLabel: name,
      text:
        `${name}, ${role}, speaking. ` +
        abbreviate(primary.contributionText, primaryCap) +
        (primary.vote ? ` My vote: ${primary.vote.toLowerCase()}.` : ""),
    });
  }

  // Dissenter
  if (dissenter && dissenter.contributionText && dissenter !== primary) {
    const role = dissenter.memberRoleTitle || "advisor";
    const name = dissenter.memberName || "Advisor";
    lines.push({
      speaker: "dissenter",
      voice: VOICE_MAP.dissenter,
      sectionKey: "dissenter",
      sectionLabel: name,
      text:
        `${name}, ${role}, taking the contrary view. ` +
        abbreviate(dissenter.contributionText, dissenterCap) +
        (dissenter.vote ? ` My vote: ${dissenter.vote.toLowerCase()}.` : ""),
    });
  }

  // Convergence note (Chair)
  if (input.convergenceNote) {
    lines.push({
      speaker: "chair",
      voice: VOICE_MAP.chair,
      sectionKey: "convergence",
      sectionLabel: "Convergence",
      text:
        "The convergence note. " + abbreviate(input.convergenceNote, convergenceCap),
    });
  }

  // Outro
  lines.push({
    speaker: "narrator",
    voice: VOICE_MAP.narrator,
    sectionKey: "outro",
    sectionLabel: "Outro",
    text: "These were the Quorum minutes. Filed for the record.",
  });

  const totalWords = lines.reduce(
    (n, l) => n + l.text.split(/\s+/).filter(Boolean).length,
    0,
  );
  const estimatedSeconds = Math.max(
    TARGET_MIN_SECONDS,
    Math.min(TARGET_MAX_SECONDS, Math.round(totalWords / WORDS_PER_SECOND)),
  );

  const voicesUsed = Array.from(new Set(lines.map((l) => l.voice)));
  return { lines, voicesUsed, estimatedSeconds };
}

// Inter-section "sting tone" assets are intentionally NOT bundled in this
// release: producing audible tones requires either an MP3 encoder dependency
// or extra OpenAI TTS calls per generation, both of which we deferred.
// Instead, sections are demarcated by (a) a brief silent pause and
// (b) the in-app waveform's section markers + jump pills. See follow-up tasks.
// 32 byte silent MP3 frame (MPEG1 Layer3, 32kbps mono, 22.05kHz).
// Used as inter-line spacer. Several frames give a perceptible pause.
const SILENT_MP3_FRAME = Buffer.from(
  "fffb1064000000000000000000000000000000000000000000000000000000000000000000000000",
  "hex",
);

export function silenceBuffer(ms: number): Buffer {
  // each frame ≈ 26ms at this configuration
  const frames = Math.max(1, Math.round(ms / 26));
  const out: Buffer[] = [];
  for (let i = 0; i < frames; i += 1) out.push(SILENT_MP3_FRAME);
  return Buffer.concat(out);
}

const TTS_MODEL = "gpt-4o-mini-tts";
// Approx pricing for gpt-4o-mini-tts per 1M characters (USD)
const TTS_COST_PER_MTOK_USD = 12; // ~$12 per 1M chars

export function estimateCostCents(script: ComposedScript): number {
  const chars = script.lines.reduce((n, l) => n + l.text.length, 0);
  const usd = (chars / 1_000_000) * TTS_COST_PER_MTOK_USD;
  return Math.max(1, Math.round(usd * 100));
}

export interface SynthesizedAudio {
  mp3: Buffer;
  durationSeconds: number;
  voicesUsed: string[];
  sections: Array<{ label: string; key: string; offsetMs: number }>;
  transcript: string;
  costCents: number;
}

export async function synthesizeScript(
  script: ComposedScript,
  logger?: Logger,
): Promise<SynthesizedAudio> {
  const chunks: Buffer[] = [];
  const sections: Array<{ label: string; key: string; offsetMs: number }> = [];
  let cumulativeMs = 0;
  const transcriptParts: string[] = [];

  for (let i = 0; i < script.lines.length; i += 1) {
    const line = script.lines[i];
    if (line.sectionKey && line.sectionLabel) {
      sections.push({
        key: line.sectionKey,
        label: line.sectionLabel,
        offsetMs: cumulativeMs,
      });
    }
    transcriptParts.push(`${line.speaker.toUpperCase()}: ${line.text}`);

    const resp = await getOpenAI().audio.speech.create({
      model: TTS_MODEL,
      voice: line.voice as "alloy" | "onyx" | "nova" | "fable" | "shimmer" | "echo",
      input: line.text,
      response_format: "mp3",
    });
    const buf = Buffer.from(await resp.arrayBuffer());
    chunks.push(buf);
    // Approx duration: bytes / (avg 4KB/s for OpenAI TTS mp3 ~= 32 kbps).
    const lineMs = Math.max(500, Math.round((buf.length / 4000) * 1000));
    cumulativeMs += lineMs;

    // Inter-line pause (skip after last).
    if (i < script.lines.length - 1) {
      const pause = silenceBuffer(450);
      chunks.push(pause);
      cumulativeMs += 450;
    }
    logger?.debug?.(
      { line: i, voice: line.voice, bytes: buf.length, lineMs },
      "TTS line synthesized",
    );
  }

  const mp3 = Buffer.concat(chunks);
  return {
    mp3,
    durationSeconds: Math.round(cumulativeMs / 1000),
    voicesUsed: script.voicesUsed,
    sections,
    transcript: transcriptParts.join("\n\n"),
    costCents: estimateCostCents(script),
  };
}
