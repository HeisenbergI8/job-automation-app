# Worker

Plain Node + Playwright script that runs once a day on my Mac:

1. Search job sites and read full job descriptions
2. Score against my criteria and master CV, pick the top 3
3. Tailor CV + cover letter
4. Auto-apply where possible, otherwise send me the link (`needs_manual`)
5. Write everything to Supabase

Not part of the Next.js app, because a browser run takes minutes and would time out in a web request.
