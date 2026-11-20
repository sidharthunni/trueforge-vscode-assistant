import * as vscode from "vscode";
import { DiffViewerManager } from "./diffViewer.js";
import { BudgetedContextRetriever } from "./contextRetriever.js";
import { ResilienceManager } from "./resilience.js";
import { InlineEditController } from "./inlineEdit.js";
import { AgentViewProvider } from "./agentPanel.js";

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("trueforge");
  const serverUrl = config.get<string>("serverUrl", "http://localhost:8790");
  const budgetTokens = config.get<number>("contextTokenBudget", 4000);

  // Initialize Core Services
  const diffViewer = new DiffViewerManager();
  const contextRetriever = new BudgetedContextRetriever(budgetTokens);
  const resilienceManager = new ResilienceManager(serverUrl, serverUrl);
  const inlineEditController = new InlineEditController(diffViewer, resilienceManager);

  // Register Webview Provider for Agent Mode Panel
  const agentProvider = new AgentViewProvider(context.extensionUri, diffViewer, contextRetriever, resilienceManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentViewProvider.viewType, agentProvider)
  );

  // Status Bar Indicator
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(circuit-board) TrueForge: Active (8790)";
  statusBar.tooltip = "TrueForge Agent Harness Connected | Primary: gemini-1.5-pro | Fallback: gemini-1.5-flash";
  statusBar.command = "trueforge.openAgentPanel";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Command: Inline Edit (Ctrl+K)
  context.subscriptions.push(
    vscode.commands.registerCommand("trueforge.inlineEdit", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await inlineEditController.triggerInlineEdit(editor);
      } else {
        vscode.window.showInformationMessage("TrueForge: Open a file and select code to use inline edit.");
      }
    })
  );

  // Command: Open Agent Mode Panel
  context.subscriptions.push(
    vscode.commands.registerCommand("trueforge.openAgentPanel", () => {
      vscode.commands.executeCommand("trueforge.agentView.focus");
    })
  );

  // Command: Undo Change
  context.subscriptions.push(
    vscode.commands.registerCommand("trueforge.undoChange", async () => {
      await diffViewer.undoLastChange();
    })
  );

  // Command: Cancel Turn
  context.subscriptions.push(
    vscode.commands.registerCommand("trueforge.cancelTurn", () => {
      agentProvider.cancelCurrentTask();
    })
  );
}

export function deactivate() {}
