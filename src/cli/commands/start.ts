import { Command } from "commander";
//import { scan } from "../core/scan";

export const start = new Command("start")
  .description("Start the development server")
  .action(() => {
    console.log("🦎 monitor is starting...");
    console.log("press q to quit");
  });
