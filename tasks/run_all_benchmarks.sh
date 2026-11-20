#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "################################################################"
echo "# TECHFEST 2026-27 | TRUEFOUNDRY FORGE-A-THON BENCHMARK SUITE   #"
echo "# Team ID: TM-5B7EEFF93DB | pallets/flask tag 3.1.3            #"
echo "################################################################"

echo ""
echo ">>> STEP 1: EXECUTING TASK A (Inline Edit & Docstring Update) <<<"
"$SCRIPT_DIR/verify_task_a.sh"

echo ""
echo ">>> STEP 2: EXECUTING TASK B (Agent Mode Multi-File Change & CLI Tests) <<<"
"$SCRIPT_DIR/verify_task_b.sh"

echo ""
echo ">>> STEP 3: EXECUTING TASK C (Resilience & Automatic Failover) <<<"
"$SCRIPT_DIR/verify_task_c.sh"

echo ""
echo "################################################################"
echo "# ALL THREE FIXED BENCHMARK TASKS: 100% PASSED & VERIFIED     #"
echo "# Ready for Video Recording and Evaluation Submission!          #"
echo "################################################################"
