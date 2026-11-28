"""Refresh the public Wikipedia topic snapshot during a build. No browser searches are inputs."""
from collections import defaultdict
from pathlib import Path
import json
import re
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = "Wikipedia:Vital articles/Level 4"
LINK = re.compile(r"\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]")
OUTPUT = Path(__file__).resolve().parents[1] / "chrome" / "topic-directory.js"


def revision(title):
    params = dict(action="query", format="json", formatversion=2, prop="revisions",
                  rvprop="ids|content", rvslots="main", titles=title, redirects=1)
    request = Request("https://en.wikipedia.org/w/api.php?" + urlencode(params),
                      headers={"User-Agent": "VaayvuDirectory (https://github.com/Mahesh-Vanga/Vaayvu)"})
    with urlopen(request, timeout=45) as response:
        rev = json.load(response)["query"]["pages"][0]["revisions"][0]
    return rev["revid"], rev["slots"]["main"]["content"]


def collect():
    main_rev, overview = revision(ROOT)
    sections = [name for name in LINK.findall(overview) if name.startswith(ROOT + "/")]
    sections = list(dict.fromkeys(name for name in sections if re.search(
        r"^\| \[\[" + re.escape(name) + r"\|[^\]]+\]\] \|\|", overview, re.M)))
    groups, seen, revisions = defaultdict(list), set(), [main_rev]
    for section in sections:
        number, body = revision(section)
        revisions.append(number)
        category = section.rsplit("/", 1)[-1]
        heading = category
        for line in body.splitlines():
            match = re.fullmatch(r"(=+)\s*(.*?)\s*\1\s*", line)
            if match:
                heading = LINK.sub(r"\1", match[2]).replace("'''", "").strip()
                continue
            if not re.match(r"^#+\s*\{\{[Ii]con\|", line):
                continue
            link = LINK.search(line)
            if not link:
                continue
            title = link[1].strip()
            if title in seen or any(c in title for c in "[]{}<>|\n") or title.startswith(("File:", "Wikipedia:", "Category:")):
                continue
            seen.add(title)
            groups[category if heading == category else category + " · " + heading].append(title)
    if len(sections) < 10 or not 9000 <= len(seen) <= 12000 or "Solar System" not in seen:
        sys.exit(f"Unexpected source layout ({len(sections)} lists, {len(seen)} articles); keeping previous snapshot.")
    credits = ("// Adapted from Wikipedia's Vital articles lists by Wikipedia contributors (article titles grouped by subject).\n"
               "// CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/\n"
               "// Source revisions: " + " ".join(f"https://en.wikipedia.org/w/index.php?oldid={r}" for r in revisions))
    payload = json.dumps(list(groups.items()), ensure_ascii=False, separators=(",", ":"))
    temp = OUTPUT.with_suffix(".tmp")
    temp.write_text(credits + "\nconst VAAYVU_TOPICS = " + payload + ";\n", encoding="utf8")
    temp.replace(OUTPUT)
    print(f"Built {len(seen):,} topic titles in {len(groups):,} groups.")


if __name__ == "__main__":
    collect()
