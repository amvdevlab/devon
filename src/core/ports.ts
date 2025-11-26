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

// ===========================
// SECTION 4: PARSING FUNCTIONS
// ===========================

/**
 * Parse macOS lsof output into PortInfo array
 * Example line: node      12345 user   23u  IPv4 0x1234      0t0  TCP 127.0.0.1:3000 (LISTEN)
 */
function parseMacPorts(raw: string): PortInfo[] {
  const lines = raw.trim().split("\n");
  const ports: PortInfo[] = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      // Split by whitespace, handling multiple spaces
      const parts = line.split(/\s+/);

      // Expected format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME (STATUS)
      // Example: node 12345 user 23u IPv4 0x1234 0t0 TCP 127.0.0.1:3000 (LISTEN)
      if (parts.length < 9) {
        console.warn(`[parseMacPorts] Skipping malformed line: ${line}`);
        continue;
      }

      const processName = parts[0];
      const pid = parseInt(parts[1], 10);
      const protocol = parts[7]; // TCP or UDP
      const addressPart = parts[8]; // e.g., 127.0.0.1:3000 or *:8080
      const statusPart = parts[9] || ""; // e.g., (LISTEN)

      if (isNaN(pid)) {
        console.warn(`[parseMacPorts] Invalid PID in line: ${line}`);
        continue;
      }

      // Parse address and port
      // Format can be: 127.0.0.1:3000, *:8080, [::1]:3000
      let address = "";
      let port = 0;

      if (addressPart.includes(":")) {
        const lastColonIndex = addressPart.lastIndexOf(":");
        address = addressPart.substring(0, lastColonIndex);
        const portStr = addressPart.substring(lastColonIndex + 1);
        port = parseInt(portStr, 10);

        // Clean up IPv6 brackets
        if (address.startsWith("[") && address.endsWith("]")) {
          address = address.slice(1, -1);
        }

        // Convert * to 0.0.0.0 for consistency
        if (address === "*") {
          address = "0.0.0.0";
        }
      }

      if (isNaN(port) || port === 0) {
        console.warn(`[parseMacPorts] Invalid port in line: ${line}`);
        continue;
      }

      // Extract status from parentheses
      let status = statusPart.replace(/[()]/g, "");
      if (!status) {
        status = "UNKNOWN";
      }

      ports.push({
        port,
        protocol: protocol.toUpperCase(),
        pid,
        processName,
        status,
        address,
        path: undefined,
      });
    } catch (error) {
      console.warn(`[parseMacPorts] Error parsing line: ${line}`, error);
    }
  }

  return ports;
}

/**
 * Parse Windows netstat output into PortInfo array
 * Example line:   TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       12345
 */
function parseWindowsPorts(raw: string): PortInfo[] {
  const lines = raw.trim().split("\n");
  const ports: PortInfo[] = [];

  // Skip header lines (first few lines are headers in netstat)
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().match(/^\s*(Proto|Active)/i)) {
      startIndex = i + 1;
      continue;
    }
    if (lines[i].trim() === "") {
      continue;
    }
    // First data line found
    if (startIndex === 0 && lines[i].trim().match(/^\s*(TCP|UDP)/i)) {
      startIndex = i;
      break;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      // Split by whitespace, handling multiple spaces
      const parts = line.split(/\s+/);

      // Expected format: Protocol LocalAddress ForeignAddress State PID
      // Example: TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       12345
      // Note: UDP doesn't have State column
      if (parts.length < 4) {
        console.warn(`[parseWindowsPorts] Skipping malformed line: ${line}`);
        continue;
      }

      const protocol = parts[0].toUpperCase();
      const localAddress = parts[1];

      let status = "UNKNOWN";
      let pid = 0;

      if (protocol === "TCP") {
        // TCP has: Protocol LocalAddr ForeignAddr State PID
        if (parts.length >= 5) {
          status = parts[3];
          pid = parseInt(parts[4], 10);
        }
      } else if (protocol === "UDP") {
        // UDP has: Protocol LocalAddr ForeignAddr PID (no State)
        if (parts.length >= 4) {
          status = "STATELESS";
          pid = parseInt(parts[3], 10);
        }
      }

      if (isNaN(pid)) {
        pid = 0; // Default to 0 if PID is not available
      }

      // Parse local address and port
      // Format: 0.0.0.0:3000 or [::]:8080
      let address = "";
      let port = 0;

      if (localAddress.includes(":")) {
        const lastColonIndex = localAddress.lastIndexOf(":");
        address = localAddress.substring(0, lastColonIndex);
        const portStr = localAddress.substring(lastColonIndex + 1);
        port = parseInt(portStr, 10);

        // Clean up IPv6 brackets
        if (address.startsWith("[") && address.endsWith("]")) {
          address = address.slice(1, -1);
        }
      }

      if (isNaN(port) || port === 0) {
        console.warn(`[parseWindowsPorts] Invalid port in line: ${line}`);
        continue;
      }

      ports.push({
        port,
        protocol,
        pid,
        processName: undefined, // Windows netstat doesn't provide process names directly
        status,
        address,
        path: undefined,
      });
    } catch (error) {
      console.warn(`[parseWindowsPorts] Error parsing line: ${line}`, error);
    }
  }

  return ports;
}

/**
 * Parse Linux ss output into PortInfo array
 * Example line: tcp   LISTEN 0      128          0.0.0.0:3000           0.0.0.0:*
 */
function parseLinuxPorts(raw: string): PortInfo[] {
  const lines = raw.trim().split("\n");
  const ports: PortInfo[] = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      // Split by whitespace, handling multiple spaces
      const parts = line.split(/\s+/);

      // Expected format: Netid State Recv-Q Send-Q Local_Address:Port Peer_Address:Port
      // Example: tcp   LISTEN 0      128    0.0.0.0:3000         0.0.0.0:*
      // Example: udp   UNCONN 0      0      0.0.0.0:5353         0.0.0.0:*
      if (parts.length < 5) {
        console.warn(`[parseLinuxPorts] Skipping malformed line: ${line}`);
        continue;
      }

      const protocol = parts[0].toUpperCase(); // tcp, udp, tcp6, udp6
      const status = parts[1]; // LISTEN, UNCONN, ESTAB, etc.
      const localAddressFull = parts[4]; // e.g., 0.0.0.0:3000 or [::]:8080

      // Parse local address and port
      let address = "";
      let port = 0;

      // Handle different address formats
      // IPv4: 0.0.0.0:3000 or 127.0.0.1:8080
      // IPv6: [::]:3000 or [::1]:8080
      // Some versions: *:3000

      if (localAddressFull.includes(":")) {
        const lastColonIndex = localAddressFull.lastIndexOf(":");
        address = localAddressFull.substring(0, lastColonIndex);
        const portStr = localAddressFull.substring(lastColonIndex + 1);

        // Handle wildcard port notation
        if (portStr === "*") {
          console.warn(`[parseLinuxPorts] Wildcard port in line: ${line}`);
          continue;
        }

        port = parseInt(portStr, 10);

        // Clean up IPv6 brackets
        if (address.startsWith("[") && address.endsWith("]")) {
          address = address.slice(1, -1);
        }

        // Convert * to 0.0.0.0 for consistency
        if (address === "*") {
          address = "0.0.0.0";
        }
      }

      if (isNaN(port) || port === 0) {
        console.warn(`[parseLinuxPorts] Invalid port in line: ${line}`);
        continue;
      }

      // Normalize protocol names (tcp6 -> TCP, udp6 -> UDP)
      let normalizedProtocol = protocol.replace(/6$/, "").toUpperCase();

      ports.push({
        port,
        protocol: normalizedProtocol,
        pid: 0, // ss -tuln doesn't provide PID without root/elevated privileges
        processName: undefined,
        status,
        address,
        path: undefined,
      });
    } catch (error) {
      console.warn(`[parseLinuxPorts] Error parsing line: ${line}`, error);
    }
  }

  return ports;
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
  // 5. Normalize
  // 6. Return PortInfo[]
}
