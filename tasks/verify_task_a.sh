#!/usr/bin/env bash
set -e

FLASK_DIR="/home/sid/.gemini/antigravity/scratch/trueforge_hackathon/flask"
PYTHON_BIN="/home/sid/.gemini/antigravity/scratch/trueforge_hackathon/venv/bin/python"

echo "=========================================================="
echo "Task A: Inline Edit Verification (Single File: helpers.py)"
echo "Team ID: TM-5B7EEFF93DB | Techfest 2026-27 Forge-a-thon"
echo "=========================================================="

cd "$FLASK_DIR"

# Ensure pristine baseline
git checkout -- src/flask/helpers.py 2>/dev/null || true

# Apply Task A Inline Edit using python script
"$PYTHON_BIN" -c "
with open('src/flask/helpers.py', 'r') as f:
    content = f.read()

target = '''def get_debug_flag() -> bool:
    \"\"\"Get whether debug mode should be enabled for the app, indicated by the
    :envvar:\`FLASK_DEBUG\` environment variable. The default is \`\`False\`\`.
    \"\"\"
    val = os.environ.get(\"FLASK_DEBUG\")
    return bool(val and val.lower() not in {\"0\", \"false\", \"no\"})'''

replacement = '''def get_debug_flag() -> bool:
    \"\"\"Get whether debug mode should be enabled for the app, indicated by the
    :envvar:\`FLASK_DEBUG\` environment variable. The default is \`\`False\`\`.

    The values \`\`'0'\`\`, \`\`'false'\`\`, \`\`'no'\`\`, \`\`'off'\`\`, and \`\`'n'\`\` (case-insensitive)
    are treated as false. Any other non-empty value is treated as true.
    \"\"\"
    val = os.environ.get(\"FLASK_DEBUG\")
    return bool(val and val.lower() not in {\"0\", \"false\", \"no\", \"off\", \"n\"})'''

if target not in content:
    print('ERROR: target function not found')
    exit(1)

new_content = content.replace(target, replacement)
with open('src/flask/helpers.py', 'w') as f:
    f.write(new_content)
print('Applied Task A edit to src/flask/helpers.py')
"

echo ""
echo "[Verification Step 1] Official Benchmark Command:"
echo "FLASK_DEBUG=off python -c \"from flask.helpers import get_debug_flag; print(get_debug_flag())\""
RESULT_OFF=$(FLASK_DEBUG=off "$PYTHON_BIN" -c "from flask.helpers import get_debug_flag; print(get_debug_flag())")
echo "Output: $RESULT_OFF"

if [ "$RESULT_OFF" != "False" ]; then
    echo "ERROR: Expected False, got '$RESULT_OFF'"
    exit 1
fi

echo ""
echo "[Verification Step 2] Additional Case-Insensitive Checks:"
RESULT_N=$(FLASK_DEBUG=n "$PYTHON_BIN" -c "from flask.helpers import get_debug_flag; print(get_debug_flag())")
RESULT_UPPER_OFF=$(FLASK_DEBUG=OFF "$PYTHON_BIN" -c "from flask.helpers import get_debug_flag; print(get_debug_flag())")
RESULT_TRUE=$(FLASK_DEBUG=1 "$PYTHON_BIN" -c "from flask.helpers import get_debug_flag; print(get_debug_flag())")

echo "FLASK_DEBUG=n   -> $RESULT_N"
echo "FLASK_DEBUG=OFF -> $RESULT_UPPER_OFF"
echo "FLASK_DEBUG=1   -> $RESULT_TRUE"

if [ "$RESULT_N" != "False" ] || [ "$RESULT_UPPER_OFF" != "False" ] || [ "$RESULT_TRUE" != "True" ]; then
    echo "ERROR: Case-insensitivity or truthy check failed!"
    exit 1
fi

echo ""
echo "[Verification Step 3] Git Diff Stat (Single File):"
git diff --stat src/flask/helpers.py

echo ""
echo "TASK A VERIFICATION: 100% PASSED"
