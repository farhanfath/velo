import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const cargoBin = path.join(os.homedir(), ".cargo", "bin");
const mingwBin = "C:\\MinGW\\bin";
const currentPath = process.env.PATH || process.env.Path || "";

const extraPaths = [cargoBin, mingwBin].filter(
  (p) => !currentPath.toLowerCase().includes(p.toLowerCase()),
);
const updatedPath = [...extraPaths, currentPath].filter(Boolean).join(path.delimiter);

const env = {
  ...process.env,
  PATH: updatedPath,
  Path: updatedPath,
};

const args = process.argv.slice(2);
const tauriCliEntry = require.resolve("@tauri-apps/cli/tauri.js");

const child = spawn(process.execPath, [tauriCliEntry, ...args], {
  stdio: "inherit",
  env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
