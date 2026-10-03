# Daily job finder

Once a day, on your Mac, this:

1. reads the job boards of the companies you list in **Settings → Company career pages**,
2. skips jobs you've already got,
3. scores the rest against your criteria and CV,
4. saves the best matches to your job list as **Found**, up to 3 a day and only jobs scoring 50 or
   more (so some days it saves fewer, or none),
5. sends you a Telegram message with them.

It also messages you when a job is marked **Needs manual**.

It reads company career pages (Greenhouse, Lever and Ashby) and, with a free JSearch key (step 6b),
LinkedIn, Indeed, JobStreet and other job sites, its own search of free job sites (step 6d), plus OnlineJobs.ph's job search. Jobs it has already reviewed are skipped, so each
run looks at new ones.

## One-time setup

You'll type a few commands into **Terminal**. Press ⌘-Space, type "Terminal" and press Enter. Paste
each command, press Enter, and wait for it to finish before the next one.

### 1. Install the finder

    cd ~/Desktop/personal/job-automation-app/worker
    npm install

### 2. Update the online database

The finder needs two new tables in your hosted Supabase project. From the project folder:

    cd ~/Desktop/personal/job-automation-app
    npx supabase db push

It lists the new migration (`20260929000100_worker.sql`). Select **Yes** and press Enter.

### 3. Make a Telegram bot (about 5 minutes)

1. Install Telegram on your phone or Mac and sign in.
2. In Telegram, search for **@BotFather** (it has a blue check mark) and open the chat.
3. Send `/newbot`. It asks for a name (anything, e.g. "My Job Finder"), then a username that must end
   in `bot` (e.g. `ross_jobfinder_bot`).
4. BotFather replies with a **token**, a long line like `1234567890:AAE...`. Copy it. Keep it
   secret: anyone with it can send messages as your bot.
5. Tap the link BotFather gives to open your new bot, press **Start**, and send it any message (e.g.
   "hi"). The bot can only message you after you've messaged it.
6. In your web browser, open this address, putting your token in place of `<TOKEN>` (keep the word
   `bot` in front of it):
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
7. On that page, find `"chat":{"id":` followed by a number, e.g. `"chat":{"id":987654321`. That
   number is your **chat ID**. If the page shows only `"result":[]`, send the bot another message and
   refresh the page.

### 4. Create the finder's settings file

    cd ~/Desktop/personal/job-automation-app/worker
    cp .env.example .env
    open -e .env

TextEdit opens the file. Fill in these four, with nothing between the `=` and the value:

- `SUPABASE_URL`: in the Supabase dashboard, open your project, go to **Project Settings → Data API**
  and copy the **Project URL** (like `https://abcd1234.supabase.co`, with nothing after `.co`).
- `SUPABASE_SERVICE_ROLE_KEY`: in **Project Settings → API Keys → Legacy API Keys**, click
  **Reveal** next to **service_role** and copy it. This key can read and change everything, so never
  share it or paste it anywhere else.
- `TELEGRAM_BOT_TOKEN`: the token from step 3.4.
- `TELEGRAM_CHAT_ID`: the number from step 3.7.

Leave the rest as they are. **Don't add `ANTHROPIC_API_KEY` to this file**: if it's there, scoring
is charged to the paid API instead of your Claude subscription. Save (⌘-S) and close TextEdit.

### 5. Check Claude Code

Scoring uses Claude Code with your Claude subscription. In Terminal:

    claude --version

If it prints a version number, you're set. If you've never signed in, run `claude` once, follow the
sign-in steps, then type `/exit`. If Claude Code isn't available or hits its usage limit, the finder
still works: it scores by your keywords instead, and the saved jobs say "Keyword score only".

Before turning on the daily schedule, check that Anthropic's current terms allow this personal use
(see "Is this allowed?" below).

### 6. Add companies

In the app, go to **Settings → Company career pages** and paste a company's job-board link, e.g.
`https://jobs.lever.co/company`, `https://job-boards.greenhouse.io/company` or
`https://jobs.ashbyhq.com/company`. To find it, open the company's Careers page and click any job:
the address bar shows one of those sites. If a link is wrong, the finder marks it in red there after
its next run.

### 6b. Add LinkedIn, Indeed and JobStreet (optional, free)

The finder can also look at LinkedIn, Indeed, JobStreet, Glassdoor and other job sites through
**JSearch**, a job-search service with a free plan (200 searches a month, no credit card). The finder
never visits those sites itself through JSearch, so nothing can get blocked. It makes at most 3 searches
a day: your target roles in the countries you listed, remote only, posted in the last 3 days.

1. Go to https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch and sign up (Google sign-in works).
2. Click **Subscribe to Test** (or **Pricing**) and choose the free **Basic** plan.
3. On the API's page, find **X-RapidAPI-Key** (in the code examples on the right) and copy it.
4. Open `worker/.env` and paste it after `JSEARCH_API_KEY=`. Save.

Without a key, the finder simply skips this step.

### 6c. Read your LinkedIn, JobStreet, Indeed and OnlineJobs.ph job alerts (recommended)

This gets you the same jobs you'd see on those sites. The finder reads your job-alert emails from Gmail
(read-only: it never changes, deletes or sends mail) and scores the jobs in them.

1. **Create job alerts** with your Gmail address:
   - LinkedIn: Jobs → search (e.g. "AI Engineer", Philippines) → filter **Remote** → turn on **Set alert**
     (daily, email).
   - JobStreet (ph.jobstreet.com): search → **Save search / Get job alerts** (email, daily).
   - Indeed (ph.indeed.com): search → **Get new jobs for this search by email**.
   - OnlineJobs.ph: **Account → Job Alerts** → add your searches with email on.
   - Glassdoor: search with location **Philippines** (and Remote) → **Create job alert**. Delete alerts for
     US locations: those jobs are almost never open to you, and each one costs a Claude check.

   OnlineJobs.ph's job search is also read directly every run (5 searches, 5 seconds apart, as its
   robots.txt asks). Check their Terms of Service if you want to be sure this is fine.
2. **Create a Gmail app password**: turn on 2-Step Verification at myaccount.google.com → Security,
   then open https://myaccount.google.com/apppasswords, name it "Job finder" and click **Create**.
3. Open `worker/.env`: check `GMAIL_ADDRESS` is your Gmail, and paste the 16-letter app password after
   `GMAIL_APP_PASSWORD=`. Save.

Each alert email is read once. To stop, delete the app password in your Google account.

### 6d. The finder's own job search (no setup; optional extras)

Besides JSearch, the finder has its own search, a Python script (`worker/jobsearch/jobsearch.py`)
with no monthly limit. On every run it searches your target roles (up to 6 role-and-country
combinations, rotating by day) on these free job sites:

- **Remotive, RemoteOK, Himalayas and Jobicy**: remote job boards. Nothing to set up. Jobs that are
  only open to other countries ("USA only", "Europe") are left out.
- **Jooble** (optional, free key): collects jobs from many local boards, including JobStreet.
  Request a key at https://jooble.org/api/about, then paste it after `JOOBLE_API_KEY=` in `worker/.env`.

It needs Python 3, which macOS asks to install the first time you type `python3` in Terminal.

**LinkedIn, Indeed and Glassdoor directly (optional, off by default).** The script can also read
these sites itself through the `python-jobspy` library. This breaks those sites' terms of use, and
they can block your Mac's internet address for a while (LinkedIn does this quickly). Your job alerts
(6c) are the safer way to get those jobs. If you still want it:

    pip3 install python-jobspy

then set `SCRAPE_JOB_SITES=true` in `worker/.env`. It then runs on every run, `npm run dry-run`
included. It needs Python 3.10 or newer (`python3 --version`).
If yours is older, install Python from python.org or Homebrew and set `PYTHON_BIN` to its path.

To try the search on its own:

    python3 worker/jobsearch/jobsearch.py "AI Engineer" --country ph --remote

### 6e. People to email (optional Hunter key)

For each job it saves, the finder looks for up to 2 people to email and writes a short draft. In the
app, the **Send email** button opens it in Gmail with everything filled in. You read it, change
anything you like, and press Send yourself. Nothing is ever sent for you.

Addresses are real ones only: either the job post prints it, or Hunter.io returns it. An address is
never guessed, and LinkedIn is never used. To add Hunter:

1. Sign up for Hunter's free plan at https://hunter.io and copy your API key from your account.
2. Open `worker/.env` and paste it after `HUNTER_API_KEY=`. Save.
3. On Hunter's account page, check how many searches a month your plan gives. If it isn't 25, put the
   number after `HUNTER_MONTHLY_SEARCHES=`.

The free plan is small, so the finder spreads its searches over the month, and many jobs will honestly
say **No email found**. **Find people** on a job asks your Mac to spend a search on that one job, and
**Use this person** rewrites the email for the other contact. Both run on your Mac, like **Find jobs
now**: it has to be awake, with `npm run schedule` installed.

### 7. Try it

    cd ~/Desktop/personal/job-automation-app/worker
    npm run dry-run

This reads and scores without saving or messaging, and prints what it would send. Scoring takes a
couple of minutes. Then:

    npm start

This time the jobs appear in your Jobs list and the message arrives on Telegram.

### 8. Run it every day

    npm run schedule

It now runs every day at 8:00, 13:00 and 18:00 in your Mac's local time. LinkedIn, Indeed and
JobStreet (JSearch) are searched on the first run of the day only, which keeps you inside the free 200
searches a month; the other runs check company career pages. To pick other hours, e.g. twice a day:
`HOURS="8 20" npm run schedule`. Your Mac doesn't have to be awake at those times:

- **Asleep at a run time** (lid closed, for example): the finder runs as soon as the Mac wakes. If it
  slept through several run times, you get one run on wake, not one per missed time.
- **Shut down at a run time**: don't count on a catch-up run. Apple only promises the catch-up after sleep.
  Run `npm start` by hand if you want that day's jobs.

To test the schedule straight away:

    launchctl kickstart gui/$(id -u)/com.jobautomation.finder

If macOS asks whether "node" or "claude" may use your keychain, choose **Always Allow**. To stop the
daily runs: `npm run unschedule`.

## Is this allowed?

The finder asks Claude Code about 10 short questions a day, from a script on your own Mac, for your
own use. Before running it daily:

1. Read Anthropic's current **Consumer Terms of Service** and **Usage Policy** (linked at the bottom of
   claude.ai), and the Claude Code documentation on **headless (non-interactive) mode** and on
   **using Claude Code with a Pro or Max plan**.
2. Check that scripted personal use like this is allowed on your plan, including any rule about
   automated or scheduled use.
3. If it isn't allowed, or you're not sure, add `SCORER=keywords` to `worker/.env`. The finder then
   never calls Claude, and everything else works the same.

## When something goes wrong

- **The Telegram message lists "Problems"**: usually a company link that no longer works. Fix or
  remove it in Settings.
- **No message at all**: open `worker/logs/finder.log` (in Finder, or run `open -e logs/finder.log`
  from the `worker` folder) and look at the last lines.
- **"Keyword score only" on jobs**: Claude Code wasn't available, or was out of usage, that day.

## For development

`npm run dev` runs against the **local** Supabase stack using `worker/.env.local` (copy
`.env.example`; the URL and `service_role` key come from `npx supabase status`). Leave the Telegram
values empty and messages are printed instead. Add `-- --dry-run` to save nothing. `SCORER=keywords`
skips Claude Code.
