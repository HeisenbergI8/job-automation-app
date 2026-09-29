import { describe, expect, it } from "vitest";
import { parseBoardLink } from "./career-boards";

describe("parseBoardLink", () => {
  it.each([
    ["https://boards.greenhouse.io/gitlab", { ats: "greenhouse", slug: "gitlab" }],
    ["https://job-boards.greenhouse.io/gitlab/jobs/8556658002", { ats: "greenhouse", slug: "gitlab" }],
    ["https://boards.greenhouse.io/embed/job_board?for=gitlab", { ats: "greenhouse", slug: "gitlab" }],
    ["jobs.lever.co/zoox/f4746da4-8eb8-43e2-b7ce-bf3c7cf9640d", { ats: "lever", slug: "zoox" }],
    ["https://jobs.ashbyhq.com/ashby", { ats: "ashby", slug: "ashby" }],
  ])("reads %s", (link, expected) => {
    expect(parseBoardLink(link)).toEqual(expected);
  });

  it("refuses other sites", () => {
    expect(parseBoardLink("https://www.linkedin.com/jobs/view/1")).toHaveProperty("error");
  });

  it("refuses a link without a board name", () => {
    expect(parseBoardLink("https://jobs.lever.co/")).toHaveProperty("error");
    expect(parseBoardLink("https://boards.greenhouse.io/embed/job_board")).toHaveProperty("error");
  });

  it("refuses text that isn't a link", () => {
    expect(parseBoardLink("not a link at all")).toHaveProperty("error");
  });
});
