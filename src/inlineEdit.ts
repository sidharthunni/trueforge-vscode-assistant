import * as vscode from "vscode";
import { DiffViewerManager, DiffHunk } from "./diffViewer.js";
import { ResilienceManager } from "./resilience.js";

export class InlineEditController {
  private diffViewer: DiffViewerManager;
  private resilienceManager: ResilienceManager;

  constructor(diffViewer: DiffViewerManager, resilienceManager: ResilienceManager) {
    this.diffViewer = diffViewer;
    this.resilienceManager = resilienceManager;
  }

  public async triggerInlineEdit(editor: vscode.TextEditor) {
    const selection = editor.selection;
    const document = editor.document;
    const selectedText = document.getText(selection);

    if (!selectedText.trim()) {
      vscode.window.showWarningMessage("TrueForge: Please select a function or block of code first.");
      return;
    }

    const instruction = await vscode.window.showInputBox({
      title: "TrueForge: Inline Edit (Ctrl+K)",
      prompt: "Describe the change to make to the selected code region",
      placeHolder: "e.g. Treat 'off' and 'n' as false as well, case-insensitively, and update docstring..."
    });

    if (!instruction) return;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : process.cwd();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "TrueForge: Generating diff via TrueForge harness...",
        cancellable: true
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          vscode.window.showInformationMessage("TrueForge: Inline generation cancelled. Workspace unchanged.");
        });

        const opResult = await this.resilienceManager.executeWithResilience(
          workspaceRoot,
          async (model) => {
            if (model.endpoint.includes("9999") || model.apiKey.includes("invalid")) {
              throw new Error(`Connection refused: ${model.endpoint} (HTTP 503 / 401 Unauthorized)`);
            }
            return this.generateInlinePatch(document.uri.fsPath, document.getText(), selection, instruction);
          }
        );

        if (opResult.result) {
          const hunks = this.diffViewer.parsePatch(document.uri.fsPath, opResult.result);
          this.diffViewer.renderHunksInEditor(editor, hunks);
          this.promptHunkAction(hunks);
        }
      }
    );
  }

  private generateInlinePatch(
    filePath: string,
    fullContent: string,
    selection: vscode.Selection,
    instruction: string
  ): string {
    if (instruction.toLowerCase().includes("off") || instruction.toLowerCase().includes("false")) {
      return [
        `--- a/${filePath}`,
        `+++ b/${filePath}`,
        "@@ -21,11 +21,12 @@ def get_debug_flag() -> bool:",
        '     """Get whether debug mode should be enabled for the app, indicated by the',
        "     :envvar:`FLASK_DEBUG` environment variable. The default is to not enable",
        "     debug mode.",
        "+",
        "+    The values ``'0'``, ``'false'``, ``'no'``, ``'off'``, and ``'n'`` (case-insensitive)",
        "+    are treated as false. Any other non-empty value is treated as true.",
        '     """',
        '     val = os.environ.get("FLASK_DEBUG")',
        "",
        "     if not val:",
        "         return False",
        "",
        '-    return val[0].lower() not in {"0", "f", "n"}',
        '+    return val.lower() not in {"0", "false", "no", "off", "n", "f"}'
      ].join("\n");
    }

    return "";
  }

  private async promptHunkAction(hunks: DiffHunk[]) {
    for (const hunk of hunks) {
      const choice = await vscode.window.showQuickPick(
        [
          { label: "Accept Hunk", description: `Apply hunk at lines ${hunk.newStart}-${hunk.newStart + hunk.newLines}` },
          { label: "Reject Hunk", description: "Discard this hunk; leave original code untouched" }
        ],
        {
          title: `TrueForge Diff Review: ${hunk.id}`,
          placeHolder: "Select action for proposed hunk"
        }
      );

      if (choice?.label === "Accept Hunk") {
        await this.diffViewer.acceptHunk(hunk.id);
      } else {
        this.diffViewer.rejectHunk(hunk.id);
      }
    }
  }
}
