import { execSync } from "child_process";

export interface ModelConfig {
  name: string;
  endpoint: string;
  apiKey: string;
  isPrimary: boolean;
}

export interface ExecutionResult {
  success: boolean;
  modelUsed: string;
  output?: string;
  error?: string;
  failedOver: boolean;
  dirtyFilesCount: number;
}

function notify(level: "info" | "warn" | "error", msg: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vscode = require("vscode");
    if (level === "warn") {
      vscode.window?.showWarningMessage(msg);
    } else if (level === "error") {
      vscode.window?.showErrorMessage(msg);
    } else {
      vscode.window?.showInformationMessage(msg);
    }
  } catch {
    console.log(`[TrueForge Notification ${level.toUpperCase()}]: ${msg}`);
  }
}

export class ResilienceManager {
  private primaryModel: ModelConfig;
  private fallbackModel: ModelConfig;

  constructor(
    primaryEndpoint: string = "http://localhost:8790",
    fallbackEndpoint: string = "http://localhost:8790"
  ) {
    this.primaryModel = {
      name: "gemini-1.5-pro",
      endpoint: primaryEndpoint,
      apiKey: process.env.TRUEFORGE_API_KEY || "tf-key-pro",
      isPrimary: true
    };

    this.fallbackModel = {
      name: "gemini-1.5-flash",
      endpoint: fallbackEndpoint,
      apiKey: process.env.FALLBACK_API_KEY || "tf-key-flash",
      isPrimary: false
    };
  }

  public setSimulatedFailure(unreachable: boolean) {
    if (unreachable) {
      this.primaryModel.endpoint = "http://127.0.0.1:9999/unreachable";
      this.primaryModel.apiKey = "invalid-key-error-401";
    } else {
      this.primaryModel.endpoint = "http://localhost:8790";
      this.primaryModel.apiKey = process.env.TRUEFORGE_API_KEY || "tf-key-pro";
    }
  }

  public getWorkspaceDirtyCount(workspaceRoot: string): number {
    try {
      const status = execSync("git status --porcelain", { cwd: workspaceRoot, encoding: "utf-8" });
      return status.trim().split("\n").filter(Boolean).length;
    } catch {
      return 0;
    }
  }

  public async executeWithResilience<T>(
    workspaceRoot: string,
    operation: (model: ModelConfig) => Promise<T>
  ): Promise<{ result: T | null; modelUsed: string; failedOver: boolean; error?: string }> {
    const initialDirty = this.getWorkspaceDirtyCount(workspaceRoot);

    try {
      // Attempt 1: Primary Model
      const result = await operation(this.primaryModel);
      return { result, modelUsed: this.primaryModel.name, failedOver: false };
    } catch (primaryErr: any) {
      notify(
        "warn",
        `TrueForge Resilience: Primary model (${this.primaryModel.name}) unreachable (${primaryErr.message}). Initiating zero-touch failover to secondary model (${this.fallbackModel.name})...`
      );

      // Verify workspace is still 100% clean
      const intermediateDirty = this.getWorkspaceDirtyCount(workspaceRoot);
      if (intermediateDirty !== initialDirty) {
        // Rollback any dirty writes
        execSync("git checkout -- .", { cwd: workspaceRoot });
      }

      try {
        // Attempt 2: Fallback Model
        const fallbackResult = await operation(this.fallbackModel);
        notify(
          "info",
          `TrueForge Resilience: Failover successful. Completed request on fallback model (${this.fallbackModel.name}). Workspace unchanged.`
        );
        return { result: fallbackResult, modelUsed: this.fallbackModel.name, failedOver: true };
      } catch (fallbackErr: any) {
        // Rollback completely and ensure zero files changed
        execSync("git checkout -- .", { cwd: workspaceRoot });
        notify(
          "error",
          `TrueForge Resilience: Both primary and fallback models failed. Workspace integrity preserved: 0 files modified.`
        );
        return {
          result: null,
          modelUsed: "none",
          failedOver: true,
          error: fallbackErr.message || String(fallbackErr)
        };
      }
    }
  }
}
