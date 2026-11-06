// node packages/tooling/src/starter/mobile-route-types/cli.ts [--check]: writes the mobile app's route types, or fails
// when they are out of date with its screens.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { settings } from "../../shared/settings.ts";
import { ROUTE_TYPES_PATH, generateRouteTypes } from "./mobile-route-types.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");
const appRoot = path.join(REPO_ROOT, settings.folders.mobile ?? "");
const committed = path.join(appRoot, ROUTE_TYPES_PATH);
const expected = await generateRouteTypes(appRoot);

if (process.argv.includes("--check")) {
	if (readFileSync(committed, "utf8") !== expected) {
		process.stderr.write(`${ROUTE_TYPES_PATH} is out of date with the screens. Run: pnpm tools mobile:route-types\n`);
		process.exit(1);
	}
} else {
	writeFileSync(committed, expected);
}
