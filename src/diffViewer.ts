import * as vscode from "vscode";
import * as fs from "fs";

export interface DiffHunk {
  id: string;
  filePath: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  oldContent: string;
  newContent: string;
  applied: boolean;
  rejected: boolean;
}

export interface FileSnapshot {
  filePath: string;
  originalContent: string;
  timestamp: number;
}

export class DiffViewerManager {
  private activeHunks: Map<string, DiffHunk[]> = new Map();
  private undoStack: FileSnapshot[] = [];
  private decorationTypeAdded: vscode.TextEditorDecorationType;
  private decorationTypeRemoved: vscode.TextEditorDecorationType;

  constructor() {
    this.decorationTypeAdded = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(46, 160, 67, 0.2)",
      isWholeLine: true,
      overviewRulerColor: "green",
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });

    this.decorationTypeRemoved = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(248, 81, 73, 0.2)",
      isWholeLine: true,
      overviewRulerColor: "red",
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });
  }

  public parsePatch(filePath: string, patchText: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const lines = patchText.split("\n");
    let currentHunk: Partial<DiffHunk> | null = null;
    let oldBuf: string[] = [];
    let newBuf: string[] = [];
    let hunkCount = 0;

    for (const line of lines) {
      if (line.startsWith("@@")) {
        if (currentHunk) {
          currentHunk.oldContent = oldBuf.join("\n");
          currentHunk.newContent = newBuf.join("\n");
          hunks.push(currentHunk as DiffHunk);
          oldBuf = [];
          newBuf = [];
        }
        hunkCount++;
        const match = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
        const oldStart = match ? parseInt(match[1], 10) : 1;
        const oldLines = match && match[2] ? parseInt(match[2], 10) : 1;
        const newStart = match ? parseInt(match[3], 10) : 1;
        const newLines = match && match[4] ? parseInt(match[4], 10) : 1;

        currentHunk = {
          id: `${filePath}#hunk-${hunkCount}`,
          filePath,
          oldStart,
          oldLines,
          newStart,
          newLines,
          applied: false,
          rejected: false
        };
      } else if (currentHunk) {
        if (line.startsWith("-")) {
          oldBuf.push(line.substring(1));
        } else if (line.startsWith("+")) {
          newBuf.push(line.substring(1));
        } else if (line.startsWith(" ")) {
          oldBuf.push(line.substring(1));
          newBuf.push(line.substring(1));
        }
      }
    }

    if (currentHunk) {
      currentHunk.oldContent = oldBuf.join("\n");
      currentHunk.newContent = newBuf.join("\n");
      hunks.push(currentHunk as DiffHunk);
    }

    this.activeHunks.set(filePath, hunks);
    return hunks;
  }

  public renderHunksInEditor(editor: vscode.TextEditor, hunks: DiffHunk[]) {
    const addedRanges: vscode.Range[] = [];
    const removedRanges: vscode.Range[] = [];

    for (const hunk of hunks) {
      if (hunk.applied || hunk.rejected) continue;
      const startLine = Math.max(0, hunk.newStart - 1);
      const endLine = startLine + Math.max(1, hunk.newLines);
      addedRanges.push(new vscode.Range(startLine, 0, endLine, 0));
    }

    editor.setDecorations(this.decorationTypeAdded, addedRanges);
  }

  public async acceptHunk(hunkId: string): Promise<boolean> {
    for (const [filePath, hunks] of this.activeHunks.entries()) {
      const target = hunks.find((h) => h.id === hunkId);
      if (target && !target.applied) {
        // Record undo snapshot before applying
        if (fs.existsSync(filePath)) {
          this.undoStack.push({
            filePath,
            originalContent: fs.readFileSync(filePath, "utf-8"),
            timestamp: Date.now()
          });
        }

        // Apply new content
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const lines = fileContent.split("\n");
        const start = target.oldStart - 1;
        const count = target.oldLines;
        const newLines = target.newContent.split("\n");

        lines.splice(start, count, ...newLines);
        fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
        target.applied = true;
        vscode.window.showInformationMessage(`TrueForge: Hunk accepted and applied to ${filePath}`);
        return true;
      }
    }
    return false;
  }

  public rejectHunk(hunkId: string): boolean {
    for (const [, hunks] of this.activeHunks.entries()) {
      const target = hunks.find((h) => h.id === hunkId);
      if (target) {
        target.rejected = true;
        vscode.window.showInformationMessage(`TrueForge: Hunk ${hunkId} rejected. Workspace untouched.`);
        return true;
      }
    }
    return false;
  }

  public async undoLastChange(): Promise<boolean> {
    const snapshot = this.undoStack.pop();
    if (!snapshot) {
      vscode.window.showInformationMessage("TrueForge: Nothing to undo.");
      return false;
    }
    fs.writeFileSync(snapshot.filePath, snapshot.originalContent, "utf-8");
    vscode.window.showInformationMessage(`TrueForge: Restored original content for ${snapshot.filePath}`);
    return true;
  }

  public clear() {
    this.activeHunks.clear();
  }
}
