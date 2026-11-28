"""Build the app Info.plist with Apple's native ATS leaf-public-key pins."""
import json
import os
import plistlib
from pathlib import Path

root = Path(os.environ["SRCROOT"])
base = plistlib.loads((root / os.environ["VAAYVU_BASE_INFO_PLIST"]).read_bytes())
output = Path(os.environ["SCRIPT_OUTPUT_FILE_0"])
directory = root.parent / "search"
local = directory / "client-deployment.json"
source = local if local.is_file() else directory / "client-deployment.example.json"

if source.stat().st_size > 8192:
    raise ValueError("Vaayvu search deployment is too large")
description = json.loads(source.read_text(encoding="utf-8"))
# Include only the public routing declaration in the signed artifact.
fields = ("country", "region", "origin", "spkiPins", "expiresAt")
base["VaayvuIndiaSearch"] = {key: description[key] for key in fields}
if description["origin"]:
    from urllib.parse import urlsplit
    origin = urlsplit(description["origin"])
    if not origin.hostname or origin.scheme != "https" or not description["spkiPins"]:
        raise ValueError("A provisioned HTTPS search origin needs leaf public-key pins")
    ats = base.setdefault("NSAppTransportSecurity", {})
    pinned = ats.setdefault("NSPinnedDomains", {})
    pinned[origin.hostname.lower()] = {"NSPinnedLeafIdentities": [
        {"SPKI-SHA256-BASE64": value.removeprefix("sha256/")} for value in description["spkiPins"]
    ]}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(plistlib.dumps(base))
