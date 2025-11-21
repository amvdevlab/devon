import { PortInfo } from "./types";

function detectOS() {
  if (process.platform === "darwin") return "mac";
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux") return "linux";
  return null;
}

export async function getPorts() {
  // 1. Detect OS
  const os = detectOS();

  if (os === null) {
    console.log("Port scanning unsupported for this platform.");
    return [];
  }

  // 2. Choose command
  // 3. Execute
  // 4. Parse
  // 5. Normalize
  // 6. Return PortInfo[]
}
