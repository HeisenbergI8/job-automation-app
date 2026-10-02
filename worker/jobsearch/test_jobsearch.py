"""Tests for jobsearch.py: python3 -m unittest discover worker/jobsearch

The API answers below follow each API's documented shape (not recorded live answers yet). The jobspy
rows use jobspy 1.2.0's real column names (jobspy/util.py desired_order).
"""

import math
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest import mock

import jobsearch

NOW = datetime.now(timezone.utc)


class Helpers(unittest.TestCase):
    def test_matches_role(self):
        self.assertTrue(jobsearch.matches_role("AI Engineer", "Senior AI Engineer"))
        self.assertTrue(jobsearch.matches_role("AI Engineer", "Engineer, Platform", ["python"]))
        self.assertFalse(jobsearch.matches_role("AI Engineer", "Account Manager"))

    def test_open_to(self):
        self.assertTrue(jobsearch.open_to("ph", ""))
        self.assertTrue(jobsearch.open_to("ph", "Worldwide"))
        self.assertTrue(jobsearch.open_to("ph", "Philippines, Vietnam"))
        self.assertTrue(jobsearch.open_to("ph", "APAC"))
        self.assertFalse(jobsearch.open_to("ph", "USA Only"))
        self.assertFalse(jobsearch.open_to("ph", "Europe"))

    def test_yearly(self):
        self.assertEqual(jobsearch.yearly(5000, "monthly"), 60000)
        self.assertEqual(jobsearch.yearly(90000, None), 90000)
        self.assertIsNone(jobsearch.yearly(40, "hourly"))
        self.assertIsNone(jobsearch.yearly(math.nan, "yearly"))

    def test_iso(self):
        self.assertEqual(jobsearch.iso(0), "1970-01-01T00:00:00+00:00")
        self.assertEqual(jobsearch.iso("2026-10-01T08:00:00Z"), "2026-10-01T08:00:00+00:00")
        self.assertEqual(jobsearch.iso(date(2026, 10, 1)), "2026-10-01T00:00:00+00:00")
        self.assertIsNone(jobsearch.iso("yesterday"))
        # A naive datetime is UTC whatever the Mac's timezone, like naive text.
        self.assertEqual(jobsearch.iso(datetime(2026, 10, 1, 8)), "2026-10-01T08:00:00+00:00")

    def test_hybrid_is_not_remote(self):
        job = jobsearch.posting("x", "https://x", "Acme", "AI Engineer (Hybrid)", "Manila", "", True, None)
        self.assertFalse(job["remote"])

    def test_no_currency_without_pay(self):
        job = jobsearch.posting("x", "https://x", "Acme", "AI Engineer", None, "", True, None, currency="USD")
        self.assertIsNone(job["salary_currency"])


class Parsers(unittest.TestCase):
    def test_remotive(self):
        body = {"jobs": [
            {"url": "https://remotive.com/1", "title": "AI Engineer", "company_name": "Acme &amp; Co",
             "candidate_required_location": "Worldwide", "description": "<p>Build <b>models</b></p>",
             "publication_date": "2026-10-01T08:00:00", "salary": "$80k", "tags": ["python"]},
            {"url": "https://remotive.com/2", "title": "AI Engineer", "company_name": "US Only Inc",
             "candidate_required_location": "USA Only"},
            {"url": "https://remotive.com/3", "title": "Sales Lead", "company_name": "Acme"},
        ]}
        [job] = jobsearch.parse_remotive(body, "AI Engineer", "ph")
        self.assertEqual(job["company"], "Acme & Co")
        self.assertEqual(job["description"], "Build models")
        self.assertEqual(job["salary_raw"], "$80k")
        self.assertTrue(job["remote"])
        self.assertEqual(job["posted_at"], "2026-10-01T08:00:00+00:00")

    def test_remoteok_skips_the_legal_notice(self):
        body = [{"legal": "API terms"},
                {"position": "Machine Learning Engineer", "company": "Acme", "url": "https://remoteok.com/1",
                 "location": "", "epoch": 1790000000, "salary_min": 0, "salary_max": 120000, "tags": ["ai"]}]
        [job] = jobsearch.parse_remoteok(body, "AI Engineer", "ph")
        self.assertIsNone(job["salary_min"])
        self.assertEqual(job["salary_max"], 120000)
        self.assertEqual(job["salary_currency"], "USD")

    def test_himalayas(self):
        body = {"jobs": [{"title": "AI Engineer", "companyName": "Acme", "applicationLink": "https://himalayas.app/1",
                          "locationRestrictions": ["Philippines"], "minSalary": 50000, "currency": "USD",
                          "pubDate": 1790000000}]}
        [job] = jobsearch.parse_himalayas(body, "AI Engineer", "ph")
        self.assertEqual(job["location"], "Philippines")
        self.assertEqual(job["salary_min"], 50000)

    def test_jobicy_scales_monthly_pay(self):
        body = {"jobs": [{"url": "https://jobicy.com/1", "jobTitle": "AI Engineer", "companyName": "Acme",
                          "jobGeo": "Anywhere", "salaryMin": 3000, "salaryPeriod": "monthly", "salaryCurrency": "USD"}]}
        [job] = jobsearch.parse_jobicy(body, "AI Engineer", "ph")
        self.assertEqual(job["salary_min"], 36000)

    def test_jooble_names_the_board(self):
        body = {"jobs": [{"title": "AI Engineer", "company": "Acme", "link": "https://jooble.org/desc/1",
                          "source": "JobStreet Philippines", "snippet": "&nbsp;Build models", "type": None,
                          "location": "Manila"}]}
        [job] = jobsearch.parse_jooble(body, remote=False)
        self.assertEqual(job["site"], "jobstreet")
        self.assertFalse(job["remote"])

    def test_jobspy_rows(self):
        rows = [
            {"site": "linkedin", "job_url": "https://www.linkedin.com/jobs/view/1", "job_url_direct": math.nan,
             "title": "AI Engineer", "company": "Acme", "location": "Manila, NCR, PH", "date_posted": date(2026, 10, 1),
             "interval": "monthly", "min_amount": 100000.0, "max_amount": math.nan, "currency": "PHP",
             "is_remote": True, "description": "Build models"},
            {"site": "indeed", "job_url": "https://ph.indeed.com/1", "title": math.nan, "company": "Acme"},
        ]
        [job] = jobsearch.parse_jobspy(rows, remote=False)
        self.assertEqual(job["url"], "https://www.linkedin.com/jobs/view/1")
        self.assertEqual(job["salary_min"], 1200000)
        self.assertIsNone(job["salary_max"])
        self.assertEqual(job["salary_currency"], "PHP")
        self.assertTrue(job["remote"])
        self.assertEqual(job["posted_at"], "2026-10-01T00:00:00+00:00")


class Search(unittest.TestCase):
    def job(self, url, days_old):
        posted = (NOW - timedelta(days=days_old)).isoformat() if days_old is not None else None
        return jobsearch.posting("x", url, "Acme", "AI Engineer", None, "", True, posted)

    def test_one_source_failing_doesnt_stop_the_others(self):
        def broken(*_):
            raise TimeoutError("timed out")

        def missing(*_):
            raise ModuleNotFoundError("jobspy")

        fine = lambda *_: [self.job("https://a", 1), self.job("https://a", 1), self.job("https://old", 10), self.job("https://b", None)]
        with mock.patch.object(jobsearch, "sources", return_value={"fine": fine, "broken": broken, "linkedin": missing}):
            result = jobsearch.search("AI Engineer", "ph", True, 3)
        self.assertEqual([job["url"] for job in result["jobs"]], ["https://a", "https://b"])
        self.assertEqual(result["errors"], ["broken: timed out", "linkedin: python-jobspy isn't installed. Run: pip3 install python-jobspy"])

    def test_sources_follow_the_env(self):
        with mock.patch.dict("os.environ", {"JOOBLE_API_KEY": "", "SCRAPE_JOB_SITES": ""}):
            self.assertEqual(set(jobsearch.sources()), {"remotive", "remoteok", "himalayas", "jobicy"})
        with mock.patch.dict("os.environ", {"JOOBLE_API_KEY": "k", "SCRAPE_JOB_SITES": "true"}):
            self.assertTrue({"jooble", "linkedin", "indeed", "glassdoor"} <= set(jobsearch.sources()))


if __name__ == "__main__":
    unittest.main()
