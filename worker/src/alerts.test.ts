import { describe, expect, it } from "vitest";
import { canonicalJobUrl, emailLinks, toPostings } from "./alerts";

describe("canonicalJobUrl", () => {
  it("strips tracking so the same job from two emails is one link", () => {
    expect(canonicalJobUrl("https://www.linkedin.com/comm/jobs/view/4012345678/?trackingId=abc&refId=x")).toBe("https://www.linkedin.com/jobs/view/4012345678/");
    expect(canonicalJobUrl("https://ph.linkedin.com/jobs/view/software-engineer-at-acme-4012345678?trk=x")).toBe("https://www.linkedin.com/jobs/view/4012345678/");
    expect(canonicalJobUrl("https://ph.jobstreet.com/job/81234567?type=alert&ref=email")).toBe("https://ph.jobstreet.com/job/81234567");
    expect(canonicalJobUrl("https://ph.indeed.com/rc/clk?jk=a1b2c3d4e5&from=ja&tk=x")).toBe("https://ph.indeed.com/viewjob?jk=a1b2c3d4e5");
    expect(canonicalJobUrl("https://example.com/careers/1?x=1")).toBe("https://example.com/careers/1?x=1");
  });
});

describe("emailLinks", () => {
  it("lists each http link once, decoding &amp;", () => {
    const html = `<a href="https://a.test/1?x=1&amp;y=2">A</a><a href='https://a.test/1?x=1&amp;y=2'>again</a><a href="mailto:x@y">m</a><a href="https://b.test">B</a>`;
    expect(emailLinks(html)).toEqual(["https://a.test/1?x=1&y=2", "https://b.test"]);
  });
});

describe("toPostings", () => {
  const links = ["https://www.linkedin.com/comm/jobs/view/4012345678/?t=1", "https://www.linkedin.com/comm/jobs/view/4099999999/?t=2"];
  const sent = new Date("2026-09-29T00:00:00Z");

  it("uses only links that are in the email, and marks hybrid jobs as not remote", () => {
    const postings = toPostings(
      [
        { title: "AI Engineer", company: "Acme", location: "Philippines (Remote)", link: 1, summary: "₱150k/month" },
        { title: "Full Stack Engineer", company: "Beta", location: "Makati (Hybrid)", link: 2, summary: "" },
        { title: "Made up", company: "Ghost", location: "Remote", link: 9, summary: "" },
      ],
      links,
      "linkedin",
      "LinkedIn",
      sent,
    );
    expect(postings.map((p) => [p.url, p.remote])).toEqual([
      ["https://www.linkedin.com/jobs/view/4012345678/", true],
      ["https://www.linkedin.com/jobs/view/4099999999/", false],
    ]);
    expect(postings[0]).toMatchObject({ site: "linkedin", company: "Acme", role: "AI Engineer", posted_at: "2026-09-29T00:00:00.000Z" });
    expect(postings[0].description).toBe("₱150k/month\n\n(From a LinkedIn job alert. Open the link for the full posting.)");
  });
});
