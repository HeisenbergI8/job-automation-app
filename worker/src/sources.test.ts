import { afterEach, describe, expect, it, vi } from "vitest";
import ashby from "../fixtures/ashby.json";
import greenhouse from "../fixtures/greenhouse.json";
import lever from "../fixtures/lever.json";
import { fetchBoard, htmlToText, parseAshby, parseGreenhouse, parseLever } from "./sources";

afterEach(() => vi.unstubAllGlobals());

describe("parseGreenhouse", () => {
  it("reads a posting and turns its escaped HTML into text", () => {
    const [job] = parseGreenhouse(greenhouse, { ats: "greenhouse", slug: "gitlab", company: null });
    expect(job).toMatchObject({
      site: "greenhouse",
      url: "https://job-boards.greenhouse.io/gitlab/jobs/8556658002",
      company: "GitLab",
      role: "AI Engineer",
      location: "Remote, Bangalore",
      remote: true,
      salary_min: null,
      posted_at: "2026-05-22T09:16:29-04:00",
    });
    expect(job.description).toMatch(/^GitLab is the intelligent orchestration platform/);
    expect(job.description).not.toMatch(/[<>]|&lt;|&quot;/);
  });

  it("uses the company name from Settings when there is one", () => {
    const [job] = parseGreenhouse(greenhouse, { ats: "greenhouse", slug: "gitlab", company: "GitLab Inc." });
    expect(job.company).toBe("GitLab Inc.");
  });
});

describe("parseLever", () => {
  it("reads salary, lists and location", () => {
    const [job] = parseLever(lever, { ats: "lever", slug: "zoox", company: null });
    expect(job).toMatchObject({
      site: "lever",
      company: "zoox",
      role: "Autonomy System Test Engineer",
      location: "Foster City, CA",
      remote: false,
      salary_min: 144000,
      salary_max: 193000,
      salary_currency: "USD",
      posted_at: "2026-05-04T23:11:01.125Z",
    });
    expect(job.description).toContain("In this role, you will:\n- Create test strategies and test plans");
    expect(job.description).toContain("About Zoox");
    expect(job.description).not.toMatch(/[<>]/);
  });
});

describe("parseAshby", () => {
  it("skips unlisted jobs and reads the salary component", () => {
    const jobs = parseAshby(ashby, { ats: "ashby", slug: "ashby", company: null });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      role: "Engineering Manager - EU",
      remote: true,
      salary_min: 110000,
      salary_max: 185000,
      salary_currency: "EUR",
      salary_raw: "€110K - €185K",
      posted_at: "2026-07-24T10:49:09.045+00:00",
    });
  });
});

describe("htmlToText", () => {
  it("decodes entities and keeps list items on their own lines", () => {
    expect(htmlToText("<p>R&amp;D &#8211; team</p><ul><li>One</li><li>Two</li></ul>")).toBe("R&D – team\n- One\n- Two");
  });
});

describe("fetchBoard", () => {
  it("reports a board name that doesn't exist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", { status: 404 })));
    await expect(fetchBoard({ ats: "ashby", slug: "nope", company: null })).rejects.toThrow("Board not found");
  });

  it("notes that Ashby links won't open when the company has switched its job pages off", async () => {
    const pages = { on: '<script>{"organization":{"hostedJobsPageSlug":"ashby"}}</script>', off: "<div id=root></div>" };
    for (const state of ["on", "off"] as const) {
      vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("api.ashbyhq.com") ? Response.json(ashby) : new Response(pages[state]))));
      const [job] = await fetchBoard({ ats: "ashby", slug: "ashby", company: "Ashby" });
      if (state === "on") expect(job.note).toBeUndefined();
      else expect(job.note).toBe("Ashby has switched off its Ashby job pages, so this link may not open. Apply on Ashby's own careers site.");
    }
  });

  it("doesn't warn when Ashby's page fails to load", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("api.ashbyhq.com") ? Response.json(ashby) : new Response("busy", { status: 503 }))));
    const [job] = await fetchBoard({ ats: "ashby", slug: "ashby", company: "Ashby" });
    expect(job.note).toBeUndefined();
  });

  it("refuses an answer in an unexpected shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "changed" })));
    await expect(fetchBoard({ ats: "greenhouse", slug: "gitlab", company: null })).rejects.toThrow("Unexpected answer");
  });
});
