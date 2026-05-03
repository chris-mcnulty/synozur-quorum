import PDFDocument from "pdfkit";
import {
  getMemoSections,
  type MemoSection,
  type SessionMemo,
} from "@workspace/api-zod";

const PAGE_MARGIN = 56;

export function renderMemoToPdf(memo: SessionMemo): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const sections = getMemoSections(memo);
      const doc = new PDFDocument({
        size: "LETTER",
        margins: {
          top: PAGE_MARGIN,
          bottom: PAGE_MARGIN,
          left: PAGE_MARGIN,
          right: PAGE_MARGIN,
        },
        info: {
          Title: `${memo.boardName} — Board memo`,
          Author: "Quorum",
          Subject: memo.questionText,
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (b: Buffer) => chunks.push(b));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      for (const section of sections) renderSection(doc, section);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function renderSection(doc: PDFKit.PDFDocument, section: MemoSection): void {
  switch (section.kind) {
    case "header": {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#7a6f5c")
        .text(
          `MINUTES — SESSION #${section.sessionId.slice(0, 8).toUpperCase()}  ·  ${section.mode}`,
          { characterSpacing: 1.5 },
        );
      doc.moveDown(0.4);
      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor("#1a1814")
        .text(`${section.boardName} — Board memo`);
      doc.moveDown(0.3);
      doc
        .font("Helvetica-Oblique")
        .fontSize(13)
        .fillColor("#4a4338")
        .text(`"${section.questionText.trim()}"`, { align: "left" });
      doc.moveDown(0.6);
      hr(doc);
      doc.moveDown(0.6);
      return;
    }
    case "text": {
      sectionHeading(doc, section.label);
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#1a1814")
        .text(section.body.trim(), { align: "left", lineGap: 2 });
      doc.moveDown(0.6);
      return;
    }
    case "voteTally": {
      sectionHeading(doc, "Vote tally");
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#1a1814")
        .text(`Yes: ${section.yes}    No: ${section.no}    Abstain: ${section.abstain}`);
      doc.moveDown(0.3);
      for (const v of section.votes) {
        const who = `${v.memberName ?? "Advisor"}${
          v.memberRoleTitle ? " — " + v.memberRoleTitle : ""
        }`;
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#3a342a")
          .text(`• ${who}  `, { continued: true })
          .font("Helvetica-Bold")
          .fillColor(voteColor(v.vote))
          .text(v.vote ?? "—");
      }
      doc.moveDown(0.6);
      return;
    }
    case "footer": {
      doc.moveDown(1);
      hr(doc);
      doc.moveDown(0.4);
      doc
        .font("Helvetica-Oblique")
        .fontSize(10)
        .fillColor("#7a6f5c")
        .text(`Signed by the ${section.boardName}  ·  ${section.date}`, { align: "left" });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#9a907c")
        .text("Quorum · Audit-grade transcript", { align: "left" });
      return;
    }
  }
}

function sectionHeading(doc: PDFKit.PDFDocument, label: string): void {
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#7a6f5c")
    .text(label.toUpperCase(), { characterSpacing: 1.2 });
  doc.moveDown(0.25);
}

function hr(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  doc
    .strokeColor("#d8cfba")
    .lineWidth(0.5)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .stroke();
}

function voteColor(v: string | null): string {
  if (v === "YES") return "#3f6b3a";
  if (v === "NO") return "#9b2f2f";
  if (v === "ABSTAIN") return "#7a6f5c";
  return "#1a1814";
}
