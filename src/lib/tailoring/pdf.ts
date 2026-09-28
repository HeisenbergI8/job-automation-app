// ROADMAP 4.5: ATS-friendly PDFs. One column, real text, standard section headings and a standard
// font: what applicant tracking systems parse reliably.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { MasterCv } from "@/lib/master-cv";

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = 54;
const WIDTH = PAGE.width - MARGIN * 2;

async function createWriter() {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // The standard fonts only cover WinAnsi; swap anything else rather than failing the render.
  const supported = new Set(regular.getCharacterSet());
  const clean = (text: string) =>
    [...text.replace(/\s+/g, " ").trim()].map((char) => (supported.has(char.codePointAt(0)!) ? char : "?")).join("");

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  function ensureSpace(height: number) {
    if (y - height < MARGIN) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  }

  function wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    let line = "";
    for (const word of clean(text).split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Writes wrapped text; `indent` shifts it right, `bullet` hangs a bullet in the indent. */
  function text(value: string, { size = 10, font = regular, indent = 0, bullet = false, gap = 2 } = {}) {
    if (!value.trim()) return;
    const lineHeight = size * 1.3;
    wrap(value, font, size, WIDTH - indent).forEach((line, index) => {
      ensureSpace(lineHeight);
      y -= lineHeight;
      if (bullet && index === 0) page.drawText("•", { x: MARGIN + indent - 9, y, size, font });
      page.drawText(line, { x: MARGIN + indent, y, size, font, color: rgb(0.1, 0.1, 0.1) });
    });
    y -= gap;
  }

  function heading(value: string) {
    ensureSpace(30);
    y -= 10;
    text(value.toUpperCase(), { size: 11, font: bold, gap: 0 });
    page.drawLine({ start: { x: MARGIN, y: y - 3 }, end: { x: PAGE.width - MARGIN, y: y - 3 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
    y -= 8;
  }

  /** A bold label on the left and a right-aligned note (dates) on the same line. */
  function row(label: string, note: string) {
    const size = 10.5;
    ensureSpace(size * 1.3);
    const noteText = clean(note);
    const noteWidth = regular.widthOfTextAtSize(noteText, size);
    const [line] = wrap(label, bold, size, WIDTH - noteWidth - 12);
    y -= size * 1.3;
    page.drawText(line ?? "", { x: MARGIN, y, size, font: bold });
    if (noteText) page.drawText(noteText, { x: PAGE.width - MARGIN - noteWidth, y, size, font: regular });
    y -= 2;
  }

  return { doc, text, heading, row, bold, space: (points: number) => (y -= points) };
}

function contactLine(cv: Pick<MasterCv, "contact">) {
  const { email, phone, location, links } = cv.contact;
  return [email, phone, location, ...links].filter(Boolean).join("  |  ");
}

const range = (start: string, end: string) => [start, end].filter(Boolean).join(" – ");

export async function renderCvPdf(cv: MasterCv) {
  const w = await createWriter();
  w.doc.setTitle(`${cv.name} – CV`);
  w.doc.setAuthor(cv.name);

  w.text(cv.name, { size: 20, font: w.bold, gap: 2 });
  w.text(cv.headline, { size: 12 });
  w.text(contactLine(cv), { size: 9.5 });

  if (cv.summary.trim()) {
    w.heading("Summary");
    w.text(cv.summary);
  }
  if (cv.skills.length) {
    w.heading("Skills");
    w.text(cv.skills.join(", "));
  }
  if (cv.experience.length) {
    w.heading("Experience");
    cv.experience.forEach((job, index) => {
      if (index) w.space(6);
      w.row(`${job.title}, ${job.employer}`, range(job.start, job.end));
      if (job.location) w.text(job.location, { size: 9.5 });
      job.bullets.forEach((bullet) => w.text(bullet, { indent: 12, bullet: true }));
    });
  }
  if (cv.education.length) {
    w.heading("Education");
    cv.education.forEach((school) => {
      w.row(`${school.qualification}, ${school.institution}`, range(school.start, school.end));
      school.details.forEach((detail) => w.text(detail, { indent: 12, bullet: true }));
    });
  }
  if (cv.certifications.length) {
    w.heading("Certifications");
    cv.certifications.forEach((cert) => w.row([cert.name, cert.issuer].filter(Boolean).join(", "), cert.date));
  }
  return w.doc.save();
}

export async function renderCoverLetterPdf({
  cv,
  company,
  paragraphs,
  date,
}: {
  cv: Pick<MasterCv, "name" | "contact">;
  company: string;
  paragraphs: string[];
  date: Date;
}) {
  const w = await createWriter();
  w.doc.setTitle(`${cv.name} – Cover letter – ${company}`);
  w.doc.setAuthor(cv.name);

  w.text(cv.name, { size: 16, font: w.bold, gap: 2 });
  w.text(contactLine(cv), { size: 9.5, gap: 20 });
  w.text(date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), { gap: 16 });
  w.text(`Dear ${company} hiring team,`, { size: 10.5, gap: 10 });
  paragraphs.forEach((paragraph) => w.text(paragraph, { size: 10.5, gap: 10 }));
  w.text("Kind regards,", { size: 10.5, gap: 2 });
  w.text(cv.name, { size: 10.5 });
  return w.doc.save();
}
