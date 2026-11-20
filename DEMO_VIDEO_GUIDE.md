# TrueForge Coding Assistant: Official Demo Video Recording Guide & Screenplay
**Competition:** Techfest 2026-27 | TrueFoundry Forge-a-thon  
**Team ID:** TM-5B7EEFF93DB  
**Maximum Length:** 4 Minutes (Strict Limit)  
**Order of Execution:** Task A -> Task B (with TrueForge Session) -> Task C  

---

## Screen Recording Setup & Window Layout
- **Resolution:** 1080p (1920x1080) at 30fps or 60fps.
- **Display Arrangement:**
  - **Left 70% of Screen:** Visual Studio Code workspace opened to `pallets/flask` (tag 3.1.3).
    - Status bar shows: `TrueForge: Active (8790)` with `gemini-1.5-pro`.
    - TrueForge Agent Mode sidebar panel open on the right edge of VS Code.
  - **Right 30% of Screen:** TrueForge Local Session Dashboard in browser (`http://localhost:8790`) or split terminal showing real-time agent SSE events and MCP tool logs.

---

## Second-by-Second Video Script (0:00 - 4:00)

### [0:00 - 0:15] Introduction & System Overview
- **Visual:** Show VS Code with `pallets/flask` workspace (tag 3.1.3). Show terminal:
  ```bash
  git status
  # Output: HEAD detached at 3.1.3, nothing to commit, working tree clean
  ```
- **On-Screen Text / Voiceover:**
  *"Welcome. This is Team TM-5B7EEFF93DB presenting our editor-native AI coding assistant built on TrueFoundry's TrueForge agent harness for Techfest 2026-27. We demonstrate Tasks A, B, and C on pallets/flask tag 3.1.3."*

---

### [0:16 - 0:48] Task A: Inline Edit (Single File)
- **Visual Action:**
  1. Open `src/flask/helpers.py`.
  2. Navigate to line 28 and highlight the `get_debug_flag` function.
  3. Press `Ctrl+K` (or `Cmd+K` on macOS) to invoke TrueForge Inline Edit.
  4. In the input box, enter the exact benchmark instruction:
     ```text
     Treat the values 'off' and 'n' as false as well, case-insensitively, and update the docstring to list every value that is treated as false.
     ```
  5. Press Enter.
  6. **Diff Appearance (Do not cut between prompt and diff):**
     - An inline diff appears in `helpers.py`. Green highlighted lines show new docstring lines and `{"0", "false", "no", "off", "n"}`. Red line shows removed code.
     - CodeLens buttons appear above the hunk: **Accept Hunk** | **Reject Hunk**.
  7. Click **Accept Hunk**.
- **On-Screen Verification (Terminal):**
  Run the exact official verification command:
  ```bash
  FLASK_DEBUG=off python -c "from flask.helpers import get_debug_flag; print(get_debug_flag())"
  ```
  **Expected Output:** `False`
  *(Optional: Also run `FLASK_DEBUG=n` -> `False` to prove case-insensitivity).*
- **Show Undo Capability (Rubric B2):**
  - Click **Undo Change** in status bar or command palette: file returns to original state.
  - Re-accept hunk or re-apply for Task B.

---

### [0:49 - 2:05] Task B: Agent Mode (3+ Files Changed Unprompted)
- **Visual Action:**
  1. Switch focus to the **TrueForge Agent Mode** sidebar panel.
  2. Note that no files are named or open.
  3. Enter the exact benchmark instruction into the prompt textarea:
     ```text
     Add a new built-in CLI command flask config that prints the loaded application's configuration as JSON, masking the values of any key containing SECRET, PASSWORD, TOKEN or KEY as '***'. It must appear in flask --help, be covered by a test, and be documented alongside the other built-in commands.
     ```
  4. Click **Run Agent Mode**.
- **Visual Milestones in Agent Panel:**
  1. **Context Assembly (Rubric B1):**
     - Panel logs:
       ```text
       Context Assembler: Budgeted 2,840/4,000 tokens across 4 files.
       - Auto-retrieved src/flask/cli.py (CLI command registry) [740 tokens]
       - Auto-retrieved tests/test_cli.py (CLI regression tests) [810 tokens]
       - Auto-retrieved docs/cli.rst (CLI user documentation) [490 tokens]
       ```
  2. **Streaming Tokens & Tool Calling:**
     - Agent streams turn thoughts and triggers MCP tools: `search_workspace`, `read_file`, and `propose_diff`.
  3. **TrueForge Session Dashboard Inspection (Mandatory Rubric Gate):**
     - Briefly bring up the browser at `http://localhost:8790` showing the active session `tf-session-task-b`.
     - Point out the turn list, tool execution logs, and context compaction status.
  4. **Diff Presentation & Hunk Review (Rubric B2):**
     - Three hunk cards appear in the panel for:
       - `src/flask/cli.py`
       - `tests/test_cli.py`
       - `docs/cli.rst`
     - Click **Accept Hunk** for each of the three files.
- **On-Screen Verification (Terminal):**
  1. Show command in `--help`:
     ```bash
     flask --help | grep config
     # Output: config  Show the loaded application's configuration as JSON.
     ```
  2. Run pytest test suite:
     ```bash
     pytest tests/test_cli.py -q
     # Output: 56 passed, 3 skipped in 0.26s
     ```
  3. Run live `flask config` command showing masked JSON:
     ```bash
     python -c "from flask import Flask; from flask.cli import cli; from click.testing import CliRunner; app = Flask('demo'); app.config['MY_SECRET_KEY'] = 'pass'; print(CliRunner().invoke(cli, ['--app', 'demo', 'config']).output)"
     # Output shows JSON with "MY_SECRET_KEY": "***"
     ```
  4. Check git diff touches 3+ files:
     ```bash
     git diff --stat
     # Shows: src/flask/cli.py, tests/test_cli.py, docs/cli.rst, src/flask/helpers.py (4 files)
     ```

---

### [2:06 - 2:38] Capability Feature: Streaming & Immediate Cancellation (Rubric A3)
- **Visual Action:**
  1. In Agent Mode panel, type a new query: `Refactor all request context hooks across flask sansio`.
  2. Click **Run Agent Mode**.
  3. Watch tokens stream in real time.
  4. Click **Cancel Run** mid-flight.
  5. **Verification on Screen:**
     - Generation aborts immediately; editor remains responsive.
     - Terminal check:
       ```bash
       git status --porcelain
       ```
       Shows no half-applied edits or corrupted files.

---

### [2:39 - 3:45] Task C: Resilience & Multi-Model Failover (Rubric B3)
- **Setup:**
  1. Configure TrueForge with an unreachable endpoint or invalid key:
     ```bash
     export TRUEFORGE_PRIMARY_ENDPOINT="http://127.0.0.1:9999"
     ```
  2. Or toggle simulated failure in extension settings.
- **Visual Action:**
  1. Select `get_debug_flag` in `helpers.py` and press `Ctrl+K`.
  2. Re-enter Task A prompt.
  3. Watch editor remain completely responsive.
  4. **Notification appears:**
     ```text
     TrueForge Resilience: Primary model unreachable (ECONNREFUSED 127.0.0.1:9999).
     Initiating zero-touch failover to secondary model (gemini-1.5-flash)...
     Failover successful. Completed request on fallback model. Workspace unchanged.
     ```
- **On-Screen Verification (Terminal):**
  Run git status to prove zero files were changed by the error:
  ```bash
  git status
  ```
  Shows workspace untouched.

---

### [3:46 - 4:00] Conclusion & Submission Wrap-Up
- **Visual:** Display GitHub repository page and Technical Write-Up PDF.
- **On-Screen Text / Voiceover:**
  *"All three tasks verified on pallets/flask 3.1.3. Built on TrueForge v0.185.1 by Team TM-5B7EEFF93DB. Thank you."*

---

## Submission Checklist
- [x] Video length under 4 minutes.
- [x] Tasks A, B, and C in exact order.
- [x] TrueForge session shown during Task B.
- [x] All terminal verification commands visible and passing.
- [x] YouTube video set to 'Unlisted' or Google Drive set to 'Anyone with the link can view'.
