#!/usr/bin/env python3
"""
fetch_ballot_measures.py

Scrapes Ballotpedia's 2026 statewide ballot measures page and writes
data/ballot-measures.json in the format expected by BallotPage.tsx.

Run manually or via GitHub Actions (refresh-data.yml).
Usage: python3 scripts/fetch_ballot_measures.py
"""

import json
import re
import ssl
import sys
import time
import urllib.request
from pathlib import Path
from html.parser import HTMLParser

REPO_ROOT   = Path(__file__).parent.parent
OUTPUT_FILE = REPO_ROOT / "data" / "ballot-measures.json"
URL         = "https://ballotpedia.org/2026_ballot_measures"
YEAR        = 2026

# Map Ballotpedia "Subject" text → our category keys
# Subjects are semicolon-separated strings like "Criminal justice; Drug policy"
SUBJECT_MAP = {
    "tax":            "fiscal_tax",
    "fiscal":         "fiscal_tax",
    "budget":         "fiscal_tax",
    "revenue":        "fiscal_tax",
    "spending":       "fiscal_tax",
    "finance":        "fiscal_tax",
    "bond":           "fiscal_tax",
    "property tax":   "fiscal_tax",
    "income tax":     "fiscal_tax",
    "sales tax":      "fiscal_tax",
    "fee":            "fiscal_tax",
    "appropriat":     "fiscal_tax",
    "healthcare":     "healthcare",
    "health care":    "healthcare",
    "medicaid":       "healthcare",
    "medical":        "healthcare",
    "hospital":       "healthcare",
    "insurance":      "healthcare",
    "drug":           "healthcare",
    "abortion":       "social_rights",
    "reproductive":   "social_rights",
    "lgbtq":          "social_rights",
    "transgender":    "social_rights",
    "gender":         "social_rights",
    "same-sex":       "social_rights",
    "marriage":       "social_rights",
    "civil rights":   "social_rights",
    "equal rights":   "social_rights",
    "discrimination": "social_rights",
    "gun":            "guns",
    "firearm":        "guns",
    "weapon":         "guns",
    "second amendment": "guns",
    "environment":    "environment",
    "climate":        "environment",
    "energy":         "environment",
    "emission":       "environment",
    "carbon":         "environment",
    "pollution":      "environment",
    "natural resource": "environment",
    "water":          "environment",
    "conservation":   "environment",
    "immigration":    "immigration",
    "immigrant":      "immigration",
    "citizenship":    "immigration",
    "border":         "immigration",
    "criminal":       "criminal_justice",
    "crime":          "criminal_justice",
    "sentencing":     "criminal_justice",
    "prison":         "criminal_justice",
    "police":         "criminal_justice",
    "law enforcement": "criminal_justice",
    "bail":           "criminal_justice",
    "parole":         "criminal_justice",
    "trafficking":    "criminal_justice",
    "military":       "military_defense",
    "defense":        "military_defense",
    "veteran":        "military_defense",
    "trade":          "trade",
    "tariff":         "trade",
}

# Map measure type abbreviation → full name
TYPE_MAP = {
    "LRCA":   "Legislatively Referred Constitutional Amendment",
    "LRSS":   "Legislatively Referred State Statute",
    "CICA":   "Citizen-Initiated Constitutional Amendment",
    "CISS":   "Citizen-Initiated State Statute",
    "IndISS": "Indirect Initiative State Statute",
    "VR":     "Voter Referendum",
    "BI":     "Bond Issue",
    "LRAQ":   "Legislative Advisory Question",
    "ACCQ":   "Advisory Constitutional Convention Question",
    "ABR":    "Annual Budget Renewal",
}

# State code lookup
STATE_CODES = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC",
    "Puerto Rico": "PR",
}

# Whether passing this measure leans conservative, by subject keyword
# Used as fallback when title/description analysis isn't enough
CONSERVATIVE_SUBJECTS = {
    "immigration",       # restrict immigration = conservative
    "guns",              # protect gun rights = conservative (but bans = progressive)
    "criminal_justice",  # tough on crime = conservative (but reform = progressive)
}

PROGRESSIVE_SUBJECTS = {
    "social_rights",     # expand rights = progressive
    "environment",       # regulation = progressive
    "healthcare",        # expand coverage = progressive
}


ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def fetch_html(url, retries=3):
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; CivicismBot/1.0)",
                "Accept": "text/html",
            })
            with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception as e:
            if attempt < retries:
                print(f"  retry {attempt+1}: {e}")
                time.sleep(3 * (attempt + 1))
            else:
                raise


def classify_subject(subject_text: str) -> str:
    """Map Ballotpedia subject string to our category key."""
    lower = subject_text.lower()
    for keyword, cat in SUBJECT_MAP.items():
        if keyword in lower:
            return cat
    return "fiscal_tax"  # default


def infer_conservative_direction(title: str, description: str, category: str) -> bool:
    """
    Infer whether passing = conservative outcome from title/description keywords.
    Returns True if passing the measure = more conservative, False if more progressive.
    """
    text = (title + " " + description).lower()

    # Explicit conservative signals
    conservative_signals = [
        "restrict", "ban", "prohibit", "limit", "reduce", "cut", "eliminate",
        "require citizenship", "enforce", "mandatory", "tougher", "stricter",
        "increase penalt", "life in prison", "notify.*homeland", "deport",
        "biological sex", "sex-based", "women.*sports", "carbon.*ban",
        "cut.*tax", "tax.*exempt", "reduce.*tax", "lower.*tax",
        "budget.*stabiliz", "spending.*limit", "repeal.*carbon",
    ]
    # Explicit progressive signals
    progressive_signals = [
        "expand", "guarantee", "universal", "protect", "equal rights",
        "non-discrimination", "allow.*public financ", "public.*fund",
        "medicaid.*expand", "increase.*minimum wage", "legalize",
        "decriminaliz", "recreational.*marijuana", "cannabis",
        "clean energy", "renewable", "climate", "carbon.*tax",
        "raise.*tax", "tax.*corporation", "wealth.*tax",
        "abortion.*access", "reproductive.*right",
    ]

    con_score = sum(1 for s in conservative_signals if re.search(s, text))
    prog_score = sum(1 for s in progressive_signals if re.search(s, text))

    if con_score > prog_score:
        return True
    if prog_score > con_score:
        return False

    # Fallback by category
    if category in CONSERVATIVE_SUBJECTS:
        return True
    if category in PROGRESSIVE_SUBJECTS:
        return False
    return True  # fiscal default: spending cuts = conservative


def parse_date(month_day: str, year: int = YEAR) -> str:
    """Convert 'November 3' → '2026-11-03'."""
    months = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
    }
    parts = month_day.strip().lower().split()
    if len(parts) >= 2:
        m = months.get(parts[0], 11)
        d = int(re.sub(r"\D", "", parts[1]) or 3)
        return f"{year}-{m:02d}-{d:02d}"
    return f"{year}-11-03"


def expand_type(abbr: str) -> str:
    return TYPE_MAP.get(abbr.strip(), abbr.strip())


def strip_tags(html_fragment: str) -> str:
    """Remove all HTML tags from a string."""
    return re.sub(r"<[^>]+>", "", html_fragment).strip()


def decode_entities(text: str) -> str:
    """Decode common HTML entities."""
    return (text
        .replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        .replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
        .replace("&#8211;", "–").replace("&#8212;", "—"))


def parse_table_rows(table_html: str) -> list[list[str]] | None:
    """
    Extract data rows from an HTML table string.
    Returns list of rows, each row a list of cell text values.
    Skips header rows (those with <th> cells).
    Returns None if this looks like a summary/jurisdiction table (not a per-state measure table).
    """
    # Check header row: reject tables with 'Jurisdiction' column (summary tables)
    first_header = re.search(r"<tr[^>]*>(.*?)</tr>", table_html, re.DOTALL | re.IGNORECASE)
    if first_header:
        header_text = strip_tags(first_header.group(1)).lower()
        if "jurisdiction" in header_text:
            return None
        # Must have 'title' or 'type' in headers to be a measures table
        if "title" not in header_text and "type" not in header_text and "name" not in header_text:
            return None

    rows = []
    for row_m in re.finditer(r"<tr[^>]*>(.*?)</tr>", table_html, re.DOTALL | re.IGNORECASE):
        row_html = row_m.group(1)
        # Skip header rows
        if re.search(r"<th", row_html, re.IGNORECASE):
            continue
        cells = []
        for cell_m in re.finditer(r"<td[^>]*>(.*?)</td>", row_html, re.DOTALL | re.IGNORECASE):
            cells.append(decode_entities(strip_tags(cell_m.group(1))).strip())
        if cells:
            rows.append(cells)
    return rows


def scrape_measures() -> list:
    """Scrape the main Ballotpedia 2026 ballot measures page using regex."""
    print(f"Fetching {URL} ...")
    html = fetch_html(URL)

    measures = []
    state_counts: dict[str, int] = {}

    # Find all state sections by their mw-headline span anchors
    # Pattern: <span class="mw-headline" id="StateName">StateName</span>
    state_pattern = re.compile(
        r'<span[^>]*class="mw-headline"[^>]*id="([^"]+)"[^>]*>([^<]+)</span>',
        re.IGNORECASE
    )

    # Collect (position, state_name) for all valid US states
    state_positions = []
    for m in state_pattern.finditer(html):
        name = m.group(2).strip()
        if name in STATE_CODES:
            state_positions.append((m.start(), name))

    if not state_positions:
        print("WARNING: No state sections found", file=sys.stderr)
        return []

    print(f"Found {len(state_positions)} state sections")

    # Find end of the ballot measures content (before page footer / sidebar tables)
    content_end = len(html)
    for end_marker in ['class="printfooter"', 'id="catlinks"', 'id="footer"']:
        idx = html.find(end_marker)
        if idx > 0:
            content_end = min(content_end, idx)
            break

    # Process each state's section (from its heading to the next state heading)
    for i, (pos, state) in enumerate(state_positions):
        next_pos = state_positions[i + 1][0] if i + 1 < len(state_positions) else content_end
        end = min(next_pos, content_end)
        section = html[pos:end]

        # Find election date(s): <b>Month Day</b> in a <p> tag
        current_date = f"{YEAR}-11-03"

        # Find all bptable tables in this section
        # Track current date as we go through bold text and tables in order
        # Split section into segments separated by <table> blocks
        remaining = section
        table_pat = re.compile(r'<table[^>]*class="[^"]*bptable[^"]*"[^>]*>.*?</table>', re.DOTALL | re.IGNORECASE)
        date_pat  = re.compile(r'<b>([^<]+)</b>', re.IGNORECASE)

        # Find all tables with their positions
        tables_found = [(m.start(), m.group(0)) for m in table_pat.finditer(section)]

        # Find all date markers with their positions
        months = r"january|february|march|april|may|june|july|august|september|october|november|december"
        date_markers = []
        for m in date_pat.finditer(section):
            text = m.group(1).strip()
            if re.search(months, text, re.IGNORECASE):
                date_markers.append((m.start(), text))

        # Process tables in order, applying the most recent date marker before each table
        date_idx = 0
        for tpos, table_html in tables_found:
            # Advance date to the last marker before this table
            while date_idx < len(date_markers) and date_markers[date_idx][0] < tpos:
                current_date = parse_date(date_markers[date_idx][1])
                date_idx += 1

            rows = parse_table_rows(table_html)
            if rows is None:
                continue
            for cols in rows:
                if len(cols) < 2:
                    continue

                TYPE_ABBRS = {
                    "LRCA", "LRSS", "CICA", "CISS", "IndISS", "VR", "BI",
                    "LRAQ", "ACCQ", "ABR", "CA", "IS", "SS",
                }
                col0 = cols[0].strip()

                if col0 in TYPE_ABBRS:
                    mtype_raw = col0
                    title     = cols[1] if len(cols) > 1 else ""
                    subject   = cols[2] if len(cols) > 2 else ""
                    desc      = cols[3] if len(cols) > 3 else ""
                else:
                    title     = col0
                    mtype_raw = cols[1] if len(cols) > 1 else ""
                    subject   = cols[2] if len(cols) > 2 else ""
                    desc      = cols[3] if len(cols) > 3 else ""

                title = title.strip()
                if not title or title in TYPE_ABBRS:
                    continue

                # Skip non-statewide (county/local) measures
                skip_kw = ["county", "parish", "city of", "town of", " district"]
                if any(k in title.lower() for k in skip_kw):
                    continue

                category     = classify_subject(subject)
                conservative = infer_conservative_direction(title, desc, category)
                mtype        = expand_type(mtype_raw)
                code         = STATE_CODES.get(state, state[:2].upper())
                summary      = desc if desc else title

                n = state_counts.get(state, 0) + 1
                state_counts[state] = n
                mid = f"{code.lower()}-{YEAR}-{n}"

                measures.append({
                    "id":                    mid,
                    "state":                 state,
                    "stateCode":             code,
                    "year":                  YEAR,
                    "title":                 title,
                    "summary":               summary,
                    "category":              category,
                    "conservativeDirection": conservative,
                    "type":                  mtype,
                    "status":                "Qualified",
                    "electionDate":          current_date,
                })

    return measures


class BallotpediaParser(HTMLParser):
    """
    Stateful HTML parser that extracts ballot measures from the
    Ballotpedia 2026_ballot_measures page structure.
    """

    def __init__(self):
        super().__init__()
        self.measures: list[dict] = []

        # Traversal state
        self._current_state: str = ""
        self._current_date: str  = f"{YEAR}-11-03"
        self._in_h3: bool        = False
        self._in_h3_span: bool   = False
        self._in_bold_p: bool    = False
        self._in_bold: bool      = False
        self._row_is_header: bool = False

        # Table state
        self._in_table: bool     = False
        self._in_thead: bool     = False
        self._in_tbody: bool     = False
        self._in_row: bool       = False
        self._in_cell: bool      = False
        self._col_index: int     = 0
        self._row_data: list     = []
        self._cell_buf: str      = ""
        self._col_headers: list  = []

        # Track nesting depth for ignoring nested tables
        self._table_depth: int   = 0

        # Known US states to filter out non-state h3 headings
        self._valid_states = set(STATE_CODES.keys())

    def handle_starttag(self, tag, attrs):
        attrs_d = dict(attrs)

        if tag == "h3":
            self._in_h3 = True

        elif tag == "span" and self._in_h3:
            self._in_h3_span = True

        elif tag == "p" and not self._in_table:
            self._in_bold_p = True

        elif tag == "b" and self._in_bold_p:
            self._in_bold = True

        elif tag == "table":
            self._table_depth += 1
            if self._table_depth == 1:
                cls = attrs_d.get("class", "")
                if "bptable" in cls or "blue" in cls:
                    self._in_table = True
                    self._col_headers = []

        elif tag == "thead" and self._in_table:
            self._in_thead = True

        elif tag == "tbody" and self._in_table:
            self._in_tbody = True

        elif tag == "tr" and self._in_table:
            self._in_row  = True
            self._row_data = []
            self._col_index = 0
            self._row_is_header = False

        elif tag in ("td", "th") and self._in_table:
            self._in_cell  = True
            self._cell_buf = ""

    def handle_endtag(self, tag):
        if tag == "h3":
            self._in_h3 = False
            self._in_h3_span = False

        elif tag == "p":
            self._in_bold_p = False
            self._in_bold   = False

        elif tag == "b":
            self._in_bold = False

        elif tag == "table":
            if self._table_depth == 1:
                self._in_table = False
                self._in_thead = False
                self._in_tbody = False
            self._table_depth = max(0, self._table_depth - 1)

        elif tag == "thead":
            self._in_thead = False

        elif tag == "tbody":
            self._in_tbody = False

        elif tag in ("td", "th") and self._in_cell:
            self._in_cell = False
            text = self._cell_buf.strip()
            if tag == "th":
                self._row_is_header = True
                self._col_headers.append(text.lower())
            elif self._in_row:
                self._row_data.append(text)
                self._col_index += 1

        elif tag == "tr" and self._in_row:
            self._in_row = False
            if not self._row_is_header:
                self._flush_row()

    def handle_data(self, data):
        if self._in_h3_span:
            self._current_state = data.strip()

        elif self._in_bold and not self._in_table:
            # Election date like "November 3" or "May 19"
            text = data.strip()
            if text and any(m in text.lower() for m in [
                "january","february","march","april","may","june",
                "july","august","september","october","november","december"
            ]):
                self._current_date = parse_date(text)

        elif self._in_cell:
            self._cell_buf += data

    def _flush_row(self):
        if not self._row_data or not self._current_state:
            return
        if self._current_state not in self._valid_states:
            return

        cols = self._row_data
        if len(cols) < 2:
            return

        # Known type abbreviations — if col 0 matches, layout is Type/Title/Subject/Desc
        TYPE_ABBRS = {
            "LRCA", "LRSS", "CICA", "CISS", "IndISS", "VR", "BI",
            "LRAQ", "ACCQ", "ABR", "LRSS\nLRCA", "CA", "IS",
        }

        col0 = cols[0].strip()

        if col0 in TYPE_ABBRS:
            # Layout: Type, Title, Subject, Description[, Result]
            mtype   = col0
            title   = cols[1] if len(cols) > 1 else ""
            subject = cols[2] if len(cols) > 2 else ""
            desc    = cols[3] if len(cols) > 3 else ""
        else:
            # Layout: Title/Name, Type, Subject, Description
            title   = col0
            mtype   = cols[1] if len(cols) > 1 else ""
            subject = cols[2] if len(cols) > 2 else ""
            desc    = cols[3] if len(cols) > 3 else ""

        title = title.strip()
        if not title or title in TYPE_ABBRS:
            return

        self.measures.append({
            "state":         self._current_state,
            "election_date": self._current_date,
            "mtype":         mtype,
            "title":         title,
            "subject":       subject,
            "description":   desc,
        })


def main():
    measures = scrape_measures()
    print(f"Scraped {len(measures)} statewide measures")

    if not measures:
        print("ERROR: No measures scraped — check page structure", file=sys.stderr)
        sys.exit(1)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(measures, f, indent=2)

    print(f"Wrote {OUTPUT_FILE}")

    # Summary by state
    from collections import Counter
    by_state = Counter(m["state"] for m in measures)
    for state, count in sorted(by_state.items()):
        print(f"  {state}: {count}")


if __name__ == "__main__":
    main()
