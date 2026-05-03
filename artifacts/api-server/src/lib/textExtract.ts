import { ObjectStorageService } from "./objectStorage";

export const MAX_GROUNDING_CHARS = 50_000;

export interface ExtractResult {
  text: string;
  characterCount: number;
  truncated: boolean;
}

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function clamp(text: string): ExtractResult {
  const cleaned = text.replace(/\u0000/g, "").trim();
  if (cleaned.length <= MAX_GROUNDING_CHARS) {
    return {
      text: cleaned,
      characterCount: cleaned.length,
      truncated: false,
    };
  }
  return {
    text: cleaned.slice(0, MAX_GROUNDING_CHARS),
    characterCount: MAX_GROUNDING_CHARS,
    truncated: true,
  };
}

export async function extractTextFromObject(
  objectPath: string,
  contentType: string,
): Promise<ExtractResult> {
  const svc = new ObjectStorageService();
  const file = await svc.getObjectEntityFile(objectPath);
  const response = await svc.downloadObject(file);
  if (!response.body) return { text: "", characterCount: 0, truncated: false };

  const buffer = await streamToBuffer(
    response.body as ReadableStream<Uint8Array>,
  );

  const ct = contentType.toLowerCase();
  if (ct.includes("pdf")) {
    const mod = (await import("pdf-parse")) as unknown as {
      default: (b: Buffer) => Promise<{ text: string }>;
    };
    const result = await mod.default(buffer);
    return clamp(result.text || "");
  }
  if (
    ct.includes("officedocument.wordprocessingml") ||
    ct.includes("msword") ||
    ct.includes("docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return clamp(result.value || "");
  }
  // text/markdown/plain — fall back to UTF-8 decode
  return clamp(buffer.toString("utf8"));
}
