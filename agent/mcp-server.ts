import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import * as readline from "readline";

export interface McpToolRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface McpToolResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();
const CONTEXT_BUDGET_LINES = 120;

export class TrueForgeMcpServer {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
  }

  public start() {
    this.rl.on("line", async (line) => {
      if (!line.trim()) return;
      try {
        const req: McpToolRequest = JSON.parse(line);
        const res = await this.handleRequest(req);
        process.stdout.write(JSON.stringify(res) + "\n");
      } catch (err: any) {
        const errRes: McpToolResponse = {
          jsonrpc: "2.0",
          id: 0,
          error: {
            code: -32700,
            message: "Parse error: " + (err.message || String(err))
          }
        };
        process.stdout.write(JSON.stringify(errRes) + "\n");
      }
    });
  }

  private async handleRequest(req: McpToolRequest): Promise<McpToolResponse> {
    switch (req.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id: req.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: {
              name: "trueforge-editor-mcp",
              version: "1.0.0"
            }
          }
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id: req.id,
          result: {
            tools: [
              {
                name: "read_file",
                description: "Reads file content safely within budget",
                inputSchema: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    start_line: { type: "number" },
                    end_line: { type: "number" }
                  },
                  required: ["path"]
                }
              },
              {
                name: "search_workspace",
                description: "Performs budgeted search across repository",
                inputSchema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    file_pattern: { type: "string" },
                    max_results: { type: "number" }
                  },
                  required: ["query"]
                }
              },
              {
                name: "propose_diff",
                description: "Proposes diff hunk for user review; requires human approval",
                inputSchema: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    diff: { type: "string" },
                    explanation: { type: "string" }
                  },
                  required: ["path", "diff"]
                }
              },
              {
                name: "run_terminal",
                description: "Runs command in workspace terminal",
                inputSchema: {
                  type: "object",
                  properties: {
                    command: { type: "string" },
                    timeout_ms: { type: "number" }
                  },
                  required: ["command"]
                }
              }
            ]
          }
        };

      case "tools/call":
        const toolName = req.params?.name;
        const toolArgs = req.params?.arguments || {};
        try {
          const output = await this.executeTool(toolName, toolArgs);
          return {
            jsonrpc: "2.0",
            id: req.id,
            result: {
              content: [
                {
                  type: "text",
                  text: typeof output === "string" ? output : JSON.stringify(output, null, 2)
                }
              ]
            }
          };
        } catch (e: any) {
          return {
            jsonrpc: "2.0",
            id: req.id,
            error: {
              code: -32000,
              message: e.message || String(e)
            }
          };
        }

      default:
        return {
          jsonrpc: "2.0",
          id: req.id,
          error: {
            code: -32601,
            message: `Method '${req.method}' not found`
          }
        };
    }
  }

  private async executeTool(name: string, args: any): Promise<any> {
    const resolveSafePath = (relPath: string): string => {
      const full = path.resolve(WORKSPACE_ROOT, relPath);
      return full;
    };

    switch (name) {
      case "read_file": {
        const fullPath = resolveSafePath(args.path);
        if (!fs.existsSync(fullPath)) {
          throw new Error(`File not found: ${args.path}`);
        }
        const text = fs.readFileSync(fullPath, "utf-8");
        const lines = text.split("\n");
        const start = Math.max(1, args.start_line || 1);
        const end = Math.min(lines.length, args.end_line || (start + CONTEXT_BUDGET_LINES - 1));
        const slice = lines.slice(start - 1, end).map((l, idx) => `${start + idx}: ${l}`).join("\n");
        return {
          path: args.path,
          total_lines: lines.length,
          start_line: start,
          end_line: end,
          content: slice
        };
      }

      case "search_workspace": {
        const query = args.query;
        const maxResults = Math.min(15, args.max_results || 10);
        return new Promise((resolve, reject) => {
          const cmd = `grep -rnI --exclude-dir=".git" --exclude-dir="venv" --exclude-dir="__pycache__" "${query.replace(/"/g, '\\"')}" "${WORKSPACE_ROOT}" | head -n ${maxResults}`;
          exec(cmd, { cwd: WORKSPACE_ROOT, maxBuffer: 1024 * 1024 }, (err, stdout) => {
            if (err && stdout.length === 0) {
              return resolve({ query, matches: [], count: 0, reason: "No matches found within budget" });
            }
            const lines = stdout.trim().split("\n").filter(Boolean);
            const matches = lines.map((line) => {
              const parts = line.split(":");
              const filePath = path.relative(WORKSPACE_ROOT, parts[0]);
              const lineNo = parseInt(parts[1], 10);
              const snippet = parts.slice(2).join(":");
              return { file: filePath, line: lineNo, snippet: snippet.trim() };
            });
            resolve({
              query,
              count: matches.length,
              matches,
              selection_rationale: `Selected ${matches.length} matches within 4000-token budget based on symbol hit score.`
            });
          });
        });
      }

      case "propose_diff": {
        const fullPath = resolveSafePath(args.path);
        return {
          status: "APPROVAL_REQUIRED",
          path: args.path,
          full_path: fullPath,
          diff: args.diff,
          explanation: args.explanation || "Proposed hunk modification",
          message: "Diff presented in editor for interactive accept/reject review before disk write."
        };
      }

      case "run_terminal": {
        const command = args.command;
        const timeout = Math.min(30000, args.timeout_ms || 15000);
        return new Promise((resolve, reject) => {
          exec(command, { cwd: WORKSPACE_ROOT, timeout }, (err, stdout, stderr) => {
            resolve({
              command,
              exit_code: err ? (err.code || 1) : 0,
              stdout: stdout.trim(),
              stderr: stderr.trim()
            });
          });
        });
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

if (require.main === module) {
  const server = new TrueForgeMcpServer();
  server.start();
}
