#!/usr/bin/env python3
"""The finder's own job search: a homemade JSearch (owner request, 2026-10-02).

Reads free job APIs that need no key (Remotive, RemoteOK, Himalayas, Jobicy) and, with a free key,
Jooble, which collects jobs from many local boards (JobStreet, Kalibrr, company sites, ...). With
SCRAPE_JOB_SITES=true it also reads LinkedIn, Indeed and Glassdoor directly through python-jobspy.
That breaks those sites' terms and can get the Mac's IP blocked, so it is off unless the owner turns
it on (see worker/README.md).

Prints {"jobs": [...], "errors": [...]} as JSON. Each job has the worker's Posting fields
(worker/src/sources.ts), so worker/src/ownsearch.ts can pass them on as they are.

    python3 jobsearch.py "AI Engineer" --country ph --remote --days 3

Only the standard library is needed; python-jobspy only for scraping. The API answers' field names
come from each API's documentation and have not been checked against a live answer yet.
"""

from __future__ import annotations

import argparse
import html
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

TIMEOUT = 30
USER_AGENT = "job-finder/1.0 (personal job search)"
# Hybrid and on-site aren't remote, whatever a board says (the same rule as sources.ts NOT_REMOTE).
NOT_REMOTE = re.compile(r"\b(hybrid|on-?site|in[- ]office)\b", re.I)
# Remote jobs open to anyone, or to someone in Asia, count as open to the owner.
OPEN_ANYWHERE = re.compile(r"\b(worldwide|anywhere|global|remote|asia|apac|asia[- ]pacific|sea|southeast asia)\b", re.I)
OPEN_TO_ASIA = re.compile(r"\b(worldwide|anywhere|global|asia|apac|asia[- ]pacific|southeast asia)\b", re.I)
# Regions in a title or location that shut the owner out, e.g. "AI Sales Engineer (EMEA)" (owner's first
# live run, 2026-10-02: Himalayas listed it as "Remote" with the region only in the title).
OTHER_REGION = re.compile(
    r"\b(emea|europe|european|latam|latin america|americas|north america|united states|usa|canada|uk|united kingdom"
    r"|germany|france|spain|netherlands|brazil|mexico|india)\b", re.I)
OTHER_REGION_CODE = re.compile(r"\b(US|EU|UK)\b")

COUNTRIES = {
    "ph": "philippines", "sg": "singapore", "au": "australia", "gb": "united kingdom", "my": "malaysia",
    "nz": "new zealand", "us": "usa", "ca": "canada", "in": "india", "jp": "japan", "hk": "hong kong",
    "id": "indonesia", "vn": "vietnam", "th": "thailand", "de": "germany", "ie": "ireland",
}
PERIODS_PER_YEAR = {"year": 1, "yearly": 1, "annual": 1, "month": 12, "monthly": 12, "week": 52, "weekly": 52}


# --- helpers ---------------------------------------------------------------------------------------

DEBUG = False


def debug(name: str, returned, kept: list) -> list:
    """With --debug, says on stderr how many jobs a source returned and how many passed the filters."""
    if DEBUG:
        print(f"{name}: {len(returned)} returned, {len(kept)} kept", file=sys.stderr)
    return kept


def get_json(url: str, data: dict | None = None):
    body = json.dumps(data).encode() if data is not None else None
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers), timeout=TIMEOUT) as response:
        return json.load(response)


def html_to_text(text: str | None) -> str:
    text = re.sub(r"<(script|style)[\s\S]*?</\1>", "", text or "", flags=re.I)
    text = re.sub(r"<li[^>]*>", "\n- ", text, flags=re.I)
    text = re.sub(r"<(br|/p|/div|/h[1-6]|/li|/ul|/ol)[^>]*>", "\n", text, flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def words(text: str) -> set[str]:
    return {word for word in re.findall(r"[a-z0-9]+", text.lower()) if len(word) > 1}


def matches_role(query: str, title: str, tags: list[str] | None = None) -> bool:
    """Boards without a real search return everything: keep jobs with most of the query in the title or tags."""
    wanted = words(query)
    have = words(title) | words(" ".join(tags or []))
    return bool(wanted) and len(wanted & have) / len(wanted) >= 0.5


def open_to(country: str, place: str | None, title: str = "") -> bool:
    """A remote job limited to other regions ("USA only", "Europe", "(EMEA)" in the title) isn't open to the owner."""
    place = (place or "").strip()
    name = COUNTRIES.get(country, country)
    if name in place.lower() or name in title.lower():
        return True
    if (OTHER_REGION.search(f"{title} {place}") or OTHER_REGION_CODE.search(f"{title} {place}")) and not OPEN_TO_ASIA.search(place):
        return False
    return not place or bool(OPEN_ANYWHERE.search(place))


def iso(value) -> str | None:
    """Unix seconds, ISO text or a date, as ISO in UTC."""
    if value in (None, ""):
        return None
    try:
        if isinstance(value, (int, float)):
            return None if math.isnan(value) else datetime.fromtimestamp(value, timezone.utc).isoformat()
        if isinstance(value, datetime):  # pandas Timestamps too; naive means UTC, as for text below
            return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()
        if isinstance(value, date):
            return datetime(value.year, value.month, value.day, tzinfo=timezone.utc).isoformat()
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return (parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def yearly(amount, period: str | None) -> float | None:
    """Yearly pay, as the owner's floor is yearly. Hourly and daily pay can't be compared: dropped."""
    if amount in (None, "") or (isinstance(amount, float) and math.isnan(amount)):
        return None
    times = PERIODS_PER_YEAR.get((period or "year").lower())
    try:
        return float(amount) * times if times else None
    except (TypeError, ValueError):
        return None


def posting(site, url, company, role, location, description, remote, posted_at,
            salary_min=None, salary_max=None, currency=None, salary_raw=None) -> dict:
    return {
        "site": site,
        "url": url,
        "company": html.unescape(str(company)).strip(),
        "role": html.unescape(str(role)).strip(),
        "location": (location or "").strip() or None,
        "description": description or "",
        "salary_min": salary_min,
        "salary_max": salary_max,
        "salary_currency": currency if salary_min is not None or salary_max is not None else None,
        "salary_raw": salary_raw or None,
        "remote": bool(remote) and not NOT_REMOTE.search(f"{role} {location or ''}"),
        "posted_at": posted_at,
    }


# --- free APIs, no key -----------------------------------------------------------------------------
# Every one of these lists remote jobs only, so they are read whatever the owner's remote preference.

def parse_remotive(body: dict, query: str, country: str) -> list[dict]:
    """https://remotive.com/api/remote-jobs: {"jobs": [{url, title, company_name, candidate_required_location, ...}]}."""
    return [
        posting("remotive", job["url"], job["company_name"], job["title"], job.get("candidate_required_location"),
                html_to_text(job.get("description")), True, iso(job.get("publication_date")), salary_raw=job.get("salary"))
        for job in body.get("jobs", [])
        if job.get("url") and job.get("title") and job.get("company_name")
        and matches_role(query, job["title"], job.get("tags")) and open_to(country, job.get("candidate_required_location"), job["title"])
    ]


def parse_remoteok(body: list, query: str, country: str) -> list[dict]:
    """https://remoteok.com/api: a list whose first item is a legal notice, then jobs with position, company, epoch, ..."""
    jobs = [job for job in body if isinstance(job, dict) and job.get("position")]
    return [
        posting("remoteok", job.get("url") or job.get("apply_url"), job["company"], job["position"], job.get("location"),
                html_to_text(job.get("description")), True, iso(job.get("epoch") or job.get("date")),
                salary_min=yearly(job.get("salary_min") or None, "year"), salary_max=yearly(job.get("salary_max") or None, "year"),
                currency="USD")
        for job in jobs
        if (job.get("url") or job.get("apply_url")) and job.get("company")
        and matches_role(query, job["position"], job.get("tags")) and open_to(country, job.get("location"), job["position"])
    ]


def parse_himalayas(body: dict, query: str, country: str) -> list[dict]:
    """https://himalayas.app/jobs/api/search: {"jobs": [{title, companyName, applicationLink, locationRestrictions, ...}]}."""
    out = []
    for job in body.get("jobs", []):
        url = job.get("applicationLink") or job.get("guid")
        places = ", ".join(job.get("locationRestrictions") or [])
        if not (url and job.get("title") and job.get("companyName")):
            continue
        if not matches_role(query, job["title"], job.get("categories")) or not open_to(country, places, job["title"]):
            continue
        currency = job.get("currency")
        out.append(posting("himalayas", url, job["companyName"], job["title"], places or "Remote",
                           html_to_text(job.get("description")), True, iso(job.get("pubDate")),
                           salary_min=yearly(job.get("minSalary"), "year"), salary_max=yearly(job.get("maxSalary"), "year"),
                           currency=currency))
    return out


def parse_jobicy(body: dict, query: str, country: str) -> list[dict]:
    """https://jobicy.com/api/v2/remote-jobs: {"jobs": [{url, jobTitle, companyName, jobGeo, salaryMin, salaryPeriod, ...}]}."""
    return [
        posting("jobicy", job["url"], job["companyName"], job["jobTitle"], job.get("jobGeo"),
                html_to_text(job.get("jobDescription") or job.get("jobExcerpt")), True, iso(job.get("pubDate")),
                salary_min=yearly(job.get("salaryMin") or job.get("annualSalaryMin"), job.get("salaryPeriod") or "year"),
                salary_max=yearly(job.get("salaryMax") or job.get("annualSalaryMax"), job.get("salaryPeriod") or "year"),
                currency=job.get("salaryCurrency"))
        for job in body.get("jobs", [])
        if job.get("url") and job.get("jobTitle") and job.get("companyName")
        and matches_role(query, job["jobTitle"], job.get("jobIndustry")) and open_to(country, job.get("jobGeo"), job["jobTitle"])
    ]


def search_remotive(query, country, remote, days):
    body = get_json(f"https://remotive.com/api/remote-jobs?{urllib.parse.urlencode({'search': query, 'limit': 50})}")
    return debug("remotive", body.get("jobs", []), parse_remotive(body, query, country))


def search_remoteok(query, country, remote, days):
    # A tag narrows the list; RemoteOK's tags are single words, so the last word of the role ("engineer").
    tag = (re.findall(r"[a-z0-9]+", query.lower()) or [""])[-1]
    body = get_json(f"https://remoteok.com/api?{urllib.parse.urlencode({'tag': tag})}")
    return debug("remoteok", body[1:], parse_remoteok(body, query, country))


def search_himalayas(query, country, remote, days):
    body = get_json(f"https://himalayas.app/jobs/api/search?{urllib.parse.urlencode({'q': query})}")
    return debug("himalayas", body.get("jobs", []), parse_himalayas(body, query, country))


def search_jobicy(query, country, remote, days):
    body = get_json(f"https://jobicy.com/api/v2/remote-jobs?{urllib.parse.urlencode({'count': 50, 'tag': query})}")
    return debug("jobicy", body.get("jobs", []), parse_jobicy(body, query, country))


# --- Jooble, free key ------------------------------------------------------------------------------

def parse_jooble(body: dict, remote: bool) -> list[dict]:
    """POST https://jooble.org/api/{key}: {"jobs": [{title, company, location, snippet, salary, source, link, updated}]}."""
    return [
        posting(site_name(job.get("source") or "jooble"), job["link"], job["company"], job["title"], job.get("location"),
                html_to_text(job.get("snippet")), remote or (job.get("type") or "").lower() == "remote", iso(job.get("updated")),
                salary_raw=job.get("salary"))
        for job in body.get("jobs", [])
        if job.get("link") and job.get("title") and job.get("company")
    ]


def search_jooble(query, country, remote, days):
    key = os.environ["JOOBLE_API_KEY"].strip()
    request = {"keywords": f"{query} remote" if remote else query, "location": COUNTRIES.get(country, country), "page": "1"}
    body = get_json(f"https://jooble.org/api/{key}", request)
    return debug("jooble", body.get("jobs", []), parse_jooble(body, remote))


# --- LinkedIn, Indeed and Glassdoor through python-jobspy (opt-in) ---------------------------------

SCRAPED_SITES = ("linkedin", "indeed", "glassdoor")


def site_name(publisher: str) -> str:
    """The names stage 6 blocks auto-applying on, as in jsearch.ts."""
    known = next((site for site in ("linkedin", "indeed", "jobstreet", "onlinejobs", "glassdoor") if site in publisher.lower()), None)
    return known or publisher.lower().strip()


def parse_jobspy(rows: list[dict], remote: bool) -> list[dict]:
    """Rows of python-jobspy's DataFrame (columns from jobspy 1.2.0's desired_order)."""
    def value(row, key):
        item = row.get(key)
        return None if item is None or (isinstance(item, float) and math.isnan(item)) else item

    out = []
    for row in rows:
        url, title, company = value(row, "job_url_direct") or value(row, "job_url"), value(row, "title"), value(row, "company")
        if not (url and title and company):
            continue
        interval = value(row, "interval")
        out.append(posting(site_name(str(value(row, "site") or "")), url, company, title, value(row, "location"),
                           value(row, "description") or "", remote or value(row, "is_remote") is True,
                           iso(value(row, "date_posted")),
                           salary_min=yearly(value(row, "min_amount"), interval), salary_max=yearly(value(row, "max_amount"), interval),
                           currency=value(row, "currency")))
    return out


def scraper(site: str):
    def search(query, country, remote, days):
        from jobspy import scrape_jobs  # only needed when scraping is on

        frame = scrape_jobs(
            site_name=[site], search_term=query, location=COUNTRIES.get(country, country), is_remote=remote,
            results_wanted=20, hours_old=days * 24, country_indeed=COUNTRIES.get(country, country),
            fetch_description=True, description_format="markdown",
        )
        rows = frame.to_dict("records")
        return debug(site, rows, parse_jobspy(rows, remote))
    return search


# --- the search ------------------------------------------------------------------------------------

def sources() -> dict:
    found = {"remotive": search_remotive, "remoteok": search_remoteok, "himalayas": search_himalayas, "jobicy": search_jobicy}
    if os.environ.get("JOOBLE_API_KEY", "").strip():
        found["jooble"] = search_jooble
    if os.environ.get("SCRAPE_JOB_SITES", "").strip().lower() == "true":
        found.update({site: scraper(site) for site in SCRAPED_SITES})
    return found


def recent(jobs: list[dict], days: int) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return [job for job in jobs if not job["posted_at"] or datetime.fromisoformat(job["posted_at"]) >= cutoff]


def search(query: str, country: str, remote: bool, days: int) -> dict:
    """Every source at once; one source failing doesn't stop the others."""
    jobs, errors = [], []
    found = sources()
    with ThreadPoolExecutor(max_workers=len(found)) as pool:
        futures = {name: pool.submit(run, query, country, remote, days) for name, run in found.items()}
        for name, future in futures.items():
            try:
                found_jobs = future.result()
                jobs.extend(debug(f"{name} posted in the last {days} days", found_jobs, recent(found_jobs, days)))
            except ModuleNotFoundError:
                errors.append(f"{name}: python-jobspy isn't installed. Run: pip3 install python-jobspy")
            except Exception as error:  # noqa: BLE001 — any failure is reported, not fatal
                errors.append(f"{name}: {error}")
    seen, unique = set(), []
    for job in jobs:
        if job["url"] not in seen:
            seen.add(job["url"])
            unique.append(job)
    return {"jobs": unique, "errors": errors}


def main() -> None:
    parser = argparse.ArgumentParser(description="Search free job APIs (and, opt-in, LinkedIn/Indeed/Glassdoor).")
    parser.add_argument("query", help='The role, e.g. "AI Engineer"')
    parser.add_argument("--country", default="ph", help="Two-letter country code (default ph)")
    parser.add_argument("--remote", action="store_true", help="Remote jobs only")
    parser.add_argument("--days", type=int, default=3, help="Posted in the last N days (default 3)")
    parser.add_argument("--debug", action="store_true", help="Say how many jobs each site returned and kept")
    args = parser.parse_args()
    global DEBUG
    DEBUG = args.debug
    sys.stdout.reconfigure(encoding="utf-8")  # launchd may start Python without a UTF-8 locale
    json.dump(search(args.query, args.country.lower(), args.remote, args.days), sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
