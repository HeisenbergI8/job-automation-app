# Theme reference image prompt

Paste the prompt below into an image model (GPT Image, Midjourney v7, Ideogram, Nano Banana).
Aspect ratio 16:9. Midjourney: append `--ar 16:9 --style raw --stylize 50`.

## Prompt

A high-fidelity UI design presentation of a personal job-application tracker web app, shown as a
clean product shot: one desktop browser window on the left (about 70% of the frame) and the same app
on a phone screen on the right, slightly overlapping, flat front view, no perspective tilt, on a plain
warm grey backdrop. It must look like a real shipped product designed by a senior product designer,
in the style of Linear, Stripe Dashboard and Things 3, calm and editorial, not a Dribbble concept.

Visual direction: "a quiet ledger". Warm off-white paper background (#F5F3EE), white cards with 1px
hairline borders (#E3E0D8), near-black ink text (#1A1A17), muted grey secondary text (#77746C). One
single accent color only, deep forest green (#1F5F4A), used sparingly for the primary button, the
active nav item and one chart line. Small corner radius (6px), almost no shadows, generous whitespace,
strict 8px grid, thin dividers between list rows. Typography: a neutral grotesk sans (like Inter or
Geist) for UI, tabular monospaced numerals for counts, dates and salaries. Clear hierarchy: one bold
page title, small uppercase section labels with letter spacing.

Desktop screen, the Dashboard:
- Slim top bar with a small wordmark "Applied." and text nav: Dashboard (active), Jobs, Analytics,
  Settings. A small "Add job" button on the right.
- A row of compact stat tiles with big numbers: Found 12, Applied 38, Needs manual 4, Screening 7,
  Interview 3, Offer 1.
- A "Today's 3" section: three job cards, each with company name, role, salary range, source site
  (Greenhouse, Lever, Ashby), a fit score like "86 fit" and two short reason chips such as
  "React + TypeScript" and "Remote, APAC hours".
- A "Follow up" list: company · role, "applied 9 days ago" in grey.
- A "Latest status changes" list with small soft pill badges: Applied (blue), Screening (violet),
  Interview (indigo), Offer (green), Needs manual (amber), Rejected (muted red), Ghosted (stone grey).
  Badges are pale tinted fills with darker text, not saturated.
- A small line chart "Applications per week" with a thin green line and no gridline clutter.

Phone screen, the Job detail page for one application:
- Company, role, salary, fit score at the top.
- A vertical status timeline with dated steps: Found Sep 2, Applied Sep 3, Screening Sep 10.
- Buttons stacked full width: "View tailored CV", "Cover letter", "ATS match 62 → 88".
- Bottom tab bar with 4 icons: Dashboard, Jobs, Analytics, Settings.
Both screens share the exact same colors, type and components so the design system reads as one.

All text must be crisp, legible, correctly spelled English. Realistic fictional company names
(Northwind, Halcyon Labs, Tessera, Brightline). Thin 1.5px line icons only.

## Avoid

No purple or blue-to-pink gradients, no glassmorphism, no neon glow, no glowing orbs or blobs, no 3D
illustrations, no robots, brains or sparkle icons, no "AI" badges, no dark cyberpunk theme, no heavy
drop shadows, no floating tilted isometric screens, no lorem ipsum, no gibberish text, no stock photos
of people, no emoji, no confetti, no rainbow of accent colors.

## Dark mode variant (optional second image)

Same layout and content. Background #121210, cards #1B1B19, borders #2A2A27, text #EDEBE6, muted
#8E8B83, accent green lifted to #5BB894. Keep it matte and low contrast, not neon.
