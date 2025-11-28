import { PortInfo } from "./types";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const platformOS: Record<string, "mac" | "windows" | "linux"> = {
  darwin: "mac",
  win32: "windows",
  linux: "linux",
};
function detectOS() {
  return platformOS[process.platform] || null;
}

const commands: Record<"mac" | "windows" | "linux", string> = {
  mac: "lsof -i -P -n",
  windows: "netstat -ano",
  linux: "ss -tuln",
};

type ParsedRow = {
  pid?: string;
  protocol?: string;
  address?: string;
  port?: string;
  status?: string;
  processName?: string;
};

function parseRaw(raw: string, os: "mac" | "windows" | "linux"): ParsedRow[] {
  if (os === "mac") return parseMac(raw);
  if (os === "windows") return parseWindows(raw);
  return parseLinux(raw);
}

function parseMac(raw: string): ParsedRow[] {
  return [];
}

function parseWindows(raw: string): ParsedRow[] {
  return [];
}

function parseLinux(raw: string): ParsedRow[] {
  return [];
}

function normalize(rows: ParsedRow[]): PortInfo[] {
  return [];
}

export async function getPorts() {
  // 1. Detect OS
  const os = detectOS();
  if (os === null) {
    console.log("Port scanning unsupported for this platform.");
    return [];
  }

  // 2. Choose Command
  const command = commands[os];

  // 3. Execute
  let raw = "";
  try {
    const { stdout } = await execAsync(command);
    raw = stdout;
  } catch {
    console.log("Failed to execute port command.");
    return [];
  }

  // 4. Parse
  const rows = parseRaw(raw, os);

  // 5. Normalize
  const ports = normalize(rows);

  // 6. Return PortInfo[]
  return ports;
}
