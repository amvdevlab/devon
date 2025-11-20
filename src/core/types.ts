export type PortInfo = {
  port: number;
  protocol: string;
  pid: number;
  processName?: string;
  status: string;
  path?: string;
  address: string;
};

export type ProcessInfo = {
  pid: number;
  name?: string;
  cpuPercent?: number; // 0 - 100
  memoryMB?: number; // MB is the standard
  uptimeSeconds?: number;
  parentPid?: number;
  path?: string;
};

export type GitHubInfo = {
  authenticated: boolean;
  username?: string;
  repos: RepoInfo[];
};

export type RepoInfo = {
  name: string;
  url?: string;
  branch: string;
  changes?: ChangeSummary;
};

export type ChangeSummary = {
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
};

export type ScanResult = {
  ports: PortInfo[];
  processes: ProcessInfo[];
  github?: GitHubInfo;
  services: ServiceInfo[];
  timestamp: number;
};

export type ServiceInfo = {
  pid: number;
  name?: string;
  path?: string;
  cpuPercent?: number;
  memoryMB?: number;
  uptimeSeconds?: number;
  ports: PortInfo[];
};
