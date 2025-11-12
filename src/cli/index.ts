/**
 * index.ts
 * CLI entry point for devon.
 *
 * Registers all commands and routes user input (via Commander.js)
 * to the appropriate handlers in src/cli/commands/.
 */

import { Command } from "commander";
import { readFileSync } from "node:fs";
// import { start } from "./commands/start";
// import { quit } from "./commands/quit";

const program = new Command();

// Read package.json to get the version
const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8")
);

program
  .name("devon")
  .description("A CLI for the devon project")
  .version(pkg.version);

// program.addCommand(start);
// program.addCommand(quit);

program.parse(process.argv);
