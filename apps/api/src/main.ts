// ============================================
// main.ts - API entry point: validate the environment, then boot
// ============================================
// Order matters. The environment is parsed ONCE (config/api-config.ts) before
// the Nest module graph is even imported — several module files decide their
// imports from the config at load time — so an invalid or missing variable
// stops the process here, before Nest bootstraps, with a message that lists
// every bad variable by name and never prints a value.
import "reflect-metadata";
import "dotenv/config";

import { EnvValidationError } from "@workspace/shared";

import { getApiConfig } from "./config/api-config";
import type { ApiConfig } from "./config/api-config.schema";

/** Exit code for "the process cannot start with this configuration". */
const INVALID_CONFIGURATION_EXIT_CODE = 1;

function loadConfigOrExit(): ApiConfig {
	try {
		return getApiConfig();
	} catch (error) {
		if (error instanceof EnvValidationError) {
			process.stderr.write(`${error.message}\n`);
			process.exit(INVALID_CONFIGURATION_EXIT_CODE);
		}
		throw error;
	}
}

const config: ApiConfig = loadConfigOrExit();
const { bootstrapApp } = await import("./bootstrap/bootstrap-app");
await bootstrapApp(config);
