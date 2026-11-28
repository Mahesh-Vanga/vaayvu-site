"""Generate Vaayvu's offline website names from a local Majestic Million CSV."""
import csv
import datetime
import hashlib
import json
import re
import sys
from pathlib import Path


def generate(source, date):
    root = Path(__file__).resolve().parent.parent
    # These public destinations also appear in the browser's third-party tracker rules.
    sites = set("adobe.com amazon.com baidu.com facebook.com instagram.com linkedin.com "
                "pinterest.com reddit.com snapchat.com tiktok.com twitter.com yandex.com yandex.ru".split())
    blocked = set(json.loads((root / "chrome/tracking.json").read_text())) - sites
    blocked.update("amazonaws.com amazontrust.com bit.ly fb.me forms.gle g.co goo.gl gstatic.com "
                   "googleusercontent.com maps.app.goo.gl ow.ly t.co tinyurl.com wa.me youtu.be".split())
    label = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
    host = re.compile(rf"(?:{label}\.)+(?:[a-z]{{2,63}}|xn--[a-z0-9-]{{1,59}})")
    domains = []
    seen = set()
    indian = 0
    with source.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            domain = row["Domain"]
            if len(domain) > 253 or not host.fullmatch(domain) or domain in seen:
                continue
            labels = domain.split(".")
            if any(".".join(labels[i:]) in blocked for i in range(len(labels) - 1)):
                continue
            if re.match(r"^(?:cdn\d*|static\d*|api|assets|pixel|metrics|adserver)\.", domain):
                continue
            if len(domains) < 10000 or (indian < 1000 and domain.endswith(".in")):
                domains.append(domain)
                seen.add(domain)
                if domain.endswith(".in"):
                    indian += 1
            if len(domains) >= 10000 and indian >= 1000:
                break
    if len(domains) < 10000 or indian < 1000:
        raise ValueError("Use a complete Majestic Million export.")
    with source.open("rb") as file:
        digest = hashlib.sha256()
        for block in iter(lambda: file.read(1048576), b""):
            digest.update(block)
    return (
        "// Derived from The Majestic Million by Majestic, https://majestic.com/reports/majestic-million\n"
        "// Licensed under CC BY 3.0, https://creativecommons.org/licenses/by/3.0/\n"
        "// Extracted and filtered domain names in source order; includes additional .in names.\n"
        f"// Source date {date.isoformat()}, CSV SHA-256 {digest.hexdigest()}\n"
        "const VAAYVU_SITE_DIRECTORY = `" + "\n".join(domains) + "`.split('\\n');\n"
        "if (typeof module !== 'undefined') module.exports = VAAYVU_SITE_DIRECTORY;\n"
    )


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python3 site-directory.py MAJESTIC.csv YYYY-MM-DD")
    sys.stdout.write(generate(Path(sys.argv[1]), datetime.date.fromisoformat(sys.argv[2])))
