#!/usr/bin/env node
/**
 * `pnpm tools [name] [args…]`: the occasional commands, behind one entry.
 * With no name it lists them, grouped and described; with a name it runs that
 * one from the repository root (lib/tools.mjs holds the list).
 */
import path from "node:path";

import { runTool } from "./lib/tools.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

process.exitCode = runTool(REPO_ROOT, process.argv.slice(2));
