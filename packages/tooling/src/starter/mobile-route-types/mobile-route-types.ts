import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { z } from "zod";

const GENERATED_FILE_NAME = "router.d.ts";
const WAIT_STEP_MS = 20;
const MAX_WAIT_STEPS = 250;

/** The committed copy, relative to the mobile app. */
export const ROUTE_TYPES_PATH = "src/runtime/router-routes.d.ts";

/** What this tool calls of Expo's route type generator. */
interface RouteTypeGenerator {
	readonly regenerateDeclarations: (directory: string, options: object) => void;
}

const RouteTypeGeneratorSchema = z.custom<RouteTypeGenerator>((value) => z.looseObject({}).safeParse(value).success);

/** Expo's generator, found the way the Expo CLI finds it. */
function loadGenerator(appRoot: string): RouteTypeGenerator {
	const fromApp = createRequire(path.join(appRoot, "package.json"));
	const fromExpo = createRequire(fromApp.resolve("expo/package.json"));
	const fromCli = createRequire(fromExpo.resolve("@expo/cli/package.json"));
	return RouteTypeGeneratorSchema.parse(fromCli("@expo/router-server/build/typed-routes"));
}

/**
 * The route types Expo Router otherwise writes only while its dev server starts, so typecheck and CI
 * have them without one. Expo writes the file in the background, so this waits for it.
 */
export async function generateRouteTypes(appRoot: string): Promise<string> {
	process.env.EXPO_ROUTER_APP_ROOT = path.join(appRoot, "src/app");
	process.env.EXPO_ROUTER_IMPORT_MODE = "sync";
	const directory = mkdtempSync(path.join(tmpdir(), "route-types-"));
	loadGenerator(appRoot).regenerateDeclarations(directory, {});
	const file = path.join(directory, GENERATED_FILE_NAME);
	for (let step = 0; step < MAX_WAIT_STEPS && !existsSync(file); step += 1) {
		await delay(WAIT_STEP_MS);
	}
	await delay(WAIT_STEP_MS);
	return readFileSync(file, "utf8");
}
