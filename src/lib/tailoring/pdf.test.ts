import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { EMPTY_CV } from "@/lib/master-cv";
import { renderCoverLetterPdf, renderCvPdf } from "./pdf";

describe("PDF rendering", () => {
  it("renders a long CV across pages, replacing characters the font can't encode", async () => {
    const cv = {
      ...EMPTY_CV,
      name: "Zoë Tester 🚀",
      headline: "Frontend Engineer",
      skills: ["React", "TypeScript"],
      experience: Array.from({ length: 12 }, (_, index) => ({
        employer: `Company ${index}`,
        title: "Engineer",
        location: "Remote",
        start: "2020",
        end: "2021",
        bullets: Array.from({ length: 4 }, () => "Built and shipped a long list of meaningful things for customers, with care and speed."),
      })),
    };
    const bytes = await renderCvPdf(cv);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toBe("Zoë Tester 🚀 – CV"); // metadata is Unicode; only drawn text is WinAnsi
  });

  it("renders a cover letter", async () => {
    const bytes = await renderCoverLetterPdf({
      cv: { name: "Sample Owner", contact: { email: "a@b.c", phone: "", location: "", links: [] } },
      company: "Kappa",
      paragraphs: ["First paragraph.", "Second paragraph."],
      date: new Date("2026-09-28"),
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
