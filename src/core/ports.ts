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
  path?: string;
};

function parseRaw(raw: string, os: "mac" | "windows" | "linux"): ParsedRow[] {
  if (os === "mac") return parseMac(raw);
  if (os === "windows") return parseWindows(raw);
  return parseLinux(raw);
}

function parseMac(raw: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = raw.split("\n");

  // skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // split each line by whitespace
    const parts = line.split(/\s+/);

    if (parts.length < 9) continue;

    const processName = parts[0];
    const pid = parts[1];
    const protocol = parts[7];
    const addressPort = parts[8] || ""; // TCP or UDP
    const status = parts[9] ? parts[9].replace(/[()]/g, "") : ""; // remove parentheses

    // extract address and port from format "127.0.0.1:3000" format
    const lastColon = addressPort.lastIndexOf(":");
    const address = lastColon !== -1 ? addressPort.slice(0, lastColon) : "";
    const port = lastColon !== -1 ? addressPort.slice(lastColon + 1) : "";

    rows.push({
      pid,
      protocol,
      address,
      port,
      status,
      processName,
    });
  }
  return rows;
}

function parseWindows(raw: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = raw.split("\n");

  // skip header lines (netstat has multiple header lines)
  for (let i = 4; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;

    const protocol = parts[0]; // TCP, UDP
    const localAddressPort = parts[1] || "";
    const status = parts[3]; // LISTENING, ESTABLISHED, etc.
    const pid = parts[4];

    const lastColon = localAddressPort.lastIndexOf(":");
    const address =
      lastColon !== -1 ? localAddressPort.slice(0, lastColon) : "";
    const port = lastColon !== -1 ? localAddressPort.slice(lastColon + 1) : "";

    rows.push({
      pid,
      protocol,
      address,
      port,
      status,
    });
  }
  return rows;
}

function parseLinux(raw: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = raw.split("\n");

  //skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;

    const protocol = parts[0];
    const status = parts[1];
    const localAddressPort = parts[4] || "";

    const lastColon = localAddressPort.lastIndexOf(":");
    const address =
      lastColon !== -1 ? localAddressPort.slice(0, lastColon) : "";
    const port = lastColon !== -1 ? localAddressPort.slice(lastColon + 1) : "";

    rows.push({
      protocol,
      address,
      port,
      status,
    });
  }
  return rows;
}

function normalize(rows: ParsedRow[]): PortInfo[] {
  return [];
}

// -----------------------------
// Export function for ports.ts
// -----------------------------

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
