# Documentation

### Core

The main functionality of this program.

###### Ports

I am dividing the fields to be included in the UI to the following:

- Port Number
- Protocol (TCP or UDP)
- PID
- ProcessName / Command (node, python, postgres)
- Status
- PATH
- Address

###### Processes

The same division for Processes.

- PID
- Name / Command (human recognition)
- CPU Percentage
- memoryMB or memoryPercent
- Uptime
- parentPID
- PATH

### Architecture

The refresh feature runs as such:

1. Frontend (Refresh button)
2. API
3. scanner.ts
4. ports.ts + processes.ts
5. combinator.ts
6. Results.JSON
7. Frontend renders updated UI

This ensures security, isolation, maintainability, deployment consistency, and professional boundaries are met.
