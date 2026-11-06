#!/usr/bin/env node
// `pnpm --filter @workspace/mobile e2e:device [-- <maestro test options>]` (enhancement 3.7): runs the Maestro
// flows (apps/mobile/.maestro) against the app on a connected phone or emulator. Run from apps/mobile.
// First it restores the phone's USB link to Metro: a Maestro session can drop it, and a development build
// then sits on its loading screen, unable to load its code.

import { spawnSync } from "node:child_process";

import { appIdOf, mailpitUrlOf, maestroArgs, maestroEnv, metroLinkArgs } from "./mobile-device-tests.ts";

const config = spawnSync("npx", ["expo", "config", "--type", "public", "--json"], { encoding: "utf8" });
if (config.status !== 0) {
	process.stderr.write(config.stderr);
	process.exit(config.status ?? 1);
}
const link = spawnSync("adb", metroLinkArgs(), { stdio: "inherit" });
if (link.status !== 0) {
	process.stderr.write("Couldn't link the phone to Metro over USB (adb reverse): a development build won't load; a release build doesn't need it.\n");
}
const extra = process.argv.slice(2).filter((argument) => argument !== "--");
const run = spawnSync("maestro", maestroArgs(appIdOf(config.stdout), mailpitUrlOf(process.env), extra), { stdio: "inherit", env: maestroEnv(process.env) });
process.exit(run.status ?? 1);
