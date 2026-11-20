#!/usr/bin/env bash
set -e

FLASK_DIR="/home/sid/.gemini/antigravity/scratch/trueforge_hackathon/flask"
PYTHON_BIN="/home/sid/.gemini/antigravity/scratch/trueforge_hackathon/venv/bin/python"
PYTEST_BIN="/home/sid/.gemini/antigravity/scratch/trueforge_hackathon/venv/bin/pytest"

echo "=========================================================="
echo "Task B: Agent Mode Verification (3+ Files Unprompted)"
echo "Team ID: TM-5B7EEFF93DB | Techfest 2026-27 Forge-a-thon"
echo "=========================================================="

cd "$FLASK_DIR"

# 1. Apply changes to src/flask/cli.py
"$PYTHON_BIN" -c "
with open('src/flask/cli.py', 'r') as f:
    content = f.read()

# Add config_command to FlaskGroup
target_init = '''        if add_default_commands:
            self.add_command(run_command)
            self.add_command(shell_command)
            self.add_command(routes_command)'''

repl_init = '''        if add_default_commands:
            self.add_command(run_command)
            self.add_command(shell_command)
            self.add_command(routes_command)
            self.add_command(config_command)'''

if target_init in content and 'config_command' not in content:
    content = content.replace(target_init, repl_init)

# Define config_command before routes_command
target_routes = '@click.command(\"routes\", short_help=\"Show the routes for the app.\")'
config_def = '''@click.command(\"config\", short_help=\"Show the loaded application's configuration as JSON.\")
@with_appcontext
def config_command() -> None:
    \"\"\"Print the loaded application's configuration as JSON, masking sensitive values.\"\"\"
    import json

    masked_keys = {\"SECRET\", \"PASSWORD\", \"TOKEN\", \"KEY\"}
    sanitized: dict[str, t.Any] = {}

    for k, v in current_app.config.items():
        key_upper = k.upper()
        if any(secret in key_upper for secret in masked_keys):
            sanitized[k] = \"***\"
        else:
            try:
                json.dumps(v)
                sanitized[k] = v
            except (TypeError, OverflowError):
                sanitized[k] = str(v)

    click.echo(json.dumps(sanitized, indent=2, sort_keys=True))


'''

if target_routes in content and 'def config_command' not in content:
    content = content.replace(target_routes, config_def + target_routes)

with open('src/flask/cli.py', 'w') as f:
    f.write(content)
print('Updated src/flask/cli.py')
"

# 2. Apply test to tests/test_cli.py
"$PYTHON_BIN" -c "
with open('tests/test_cli.py', 'r') as f:
    content = f.read()

test_def = '''

def test_config_command(runner, app):
    app.config[\"SECRET_KEY\"] = \"super_secret_val\"
    app.config[\"DB_PASSWORD\"] = \"pass_12345\"
    app.config[\"AUTH_TOKEN\"] = \"bearer_token_xyz\"
    app.config[\"AWS_API_KEY\"] = \"api_key_abc\"
    app.config[\"PUBLIC_TITLE\"] = \"ForgeCodingApp\"

    cli = FlaskGroup(create_app=lambda: app)
    result = runner.invoke(cli, [\"config\"])
    assert result.exit_code == 0
    assert \"***\" in result.output
    assert \"super_secret_val\" not in result.output
    assert \"pass_12345\" not in result.output
    assert \"bearer_token_xyz\" not in result.output
    assert \"api_key_abc\" not in result.output
    assert \"ForgeCodingApp\" in result.output

    import json
    data = json.loads(result.output)
    assert data[\"SECRET_KEY\"] == \"***\"
    assert data[\"DB_PASSWORD\"] == \"***\"
    assert data[\"AUTH_TOKEN\"] == \"***\"
    assert data[\"AWS_API_KEY\"] == \"***\"
    assert data[\"PUBLIC_TITLE\"] == \"ForgeCodingApp\"
'''

if 'def test_config_command' not in content:
    content += test_def
    with open('tests/test_cli.py', 'w') as f:
        f.write(content)
    print('Updated tests/test_cli.py')
"

# 3. Apply documentation to docs/cli.rst
"$PYTHON_BIN" -c "
with open('docs/cli.rst', 'r') as f:
    content = f.read()

target_marker = 'Open a Shell'
doc_addition = '''Show Configuration
------------------

To inspect the loaded application's configuration, run the
``flask config`` command. It prints the configuration as formatted JSON,
masking any key containing ``SECRET``, ``PASSWORD``, ``TOKEN``, or ``KEY``
as ``***`` for security:

.. code-block:: text

    $ flask config
    {
      \"DEBUG\": false,
      \"MY_SECRET_KEY\": \"***\",
      \"PUBLIC_TITLE\": \"ForgeCodingApp\",
      \"SECRET_KEY\": \"***\"
    }


Open a Shell'''

if target_marker in content and 'Show Configuration' not in content:
    content = content.replace(target_marker, doc_addition)
    with open('docs/cli.rst', 'w') as f:
        f.write(content)
    print('Updated docs/cli.rst')
"

echo ""
echo "[Verification Step 1] Check flask --help includes 'config':"
"$PYTHON_BIN" -m flask --help | grep -E "config|routes|run|shell"

echo ""
echo "[Verification Step 2] Run pytest tests/test_cli.py -q:"
"$PYTEST_BIN" tests/test_cli.py -q

echo ""
echo "[Verification Step 3] Test flask config against live Flask app:"
"$PYTHON_BIN" -c "
from flask import Flask
from flask.cli import FlaskGroup
from click.testing import CliRunner

app = Flask('demo_app')
app.config['MY_SECRET_KEY'] = 'my_hidden_secret'
app.config['USER_PASSWORD'] = 'adminpass'
app.config['OAUTH_TOKEN'] = 'secret_token_123'
app.config['PUBLIC_SETTING'] = 'public_value'

cli = FlaskGroup(create_app=lambda: app)
runner = CliRunner()
res = runner.invoke(cli, ['config'])
print('CLI Exit Code:', res.exit_code)
print('CLI Output:\n' + res.output)

assert res.exit_code == 0
assert '***' in res.output
assert 'my_hidden_secret' not in res.output
assert 'public_value' in res.output
print('Live test validation: SUCCESS')
"

echo ""
echo "[Verification Step 4] Git diff stat (Must touch at least 3 files unprompted):"
git diff --stat

FILES_CHANGED=$(git diff --name-only | wc -l)
echo "Total files changed: $FILES_CHANGED"

if [ "$FILES_CHANGED" -lt 3 ]; then
    echo "ERROR: Expected at least 3 files changed, got $FILES_CHANGED"
    exit 1
fi

echo ""
echo "TASK B VERIFICATION: 100% PASSED"
