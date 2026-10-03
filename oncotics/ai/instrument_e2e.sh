#!/bin/bash
# Test-only copy of the built Workbench that exposes its in-memory state to the Playwright
# harness as window.__oiTest. Never used for the deployed site.
# Usage: instrument_e2e.sh <built workbench html> <output html>
set -euo pipefail
python3 - "$1" "$2" <<'PY'
import sys
s = open(sys.argv[1]).read()
end = 'render();\n})();'
assert s.count(end) == 1, 'unexpected end of the Workbench script'
s = s.replace(end, 'render();\nwindow.__oiTest = { get S() { return S; }, PACKS: PACKS, v3: v3, scheduleRender: scheduleRender };\n})();')
open(sys.argv[2], 'w').write(s)
PY
