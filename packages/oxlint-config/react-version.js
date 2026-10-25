import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

const ReactManifestSchema = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+/u) });

/**
 * The React version installed in the workspace being linted — what ESLint's
 * `settings.react.version: "detect"` resolved. Oxlint needs a concrete version
 * (it rejects "detect"), and reading it from the workspace keeps it from ever
 * drifting from package.json. Oxlint runs with the workspace as its working
 * directory (each workspace's `lint` script).
 *
 * The lookup is Node's node_modules walk from the workspace and nothing else:
 * `require.resolve` would also consult `NODE_PATH`, which pnpm's bin shims point
 * at the store's hoisted packages, and so report SOME React for a workspace
 * that installs none.
 *
 * @returns {string}
 */
export function installedReactVersion() {
	const workspace = process.cwd();
	for (let directory = workspace; ; directory = path.dirname(directory)) {
		const manifestPath = path.join(directory, "node_modules", "react", "package.json");
		if (existsSync(manifestPath)) {
			return ReactManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8"))).version;
		}
		if (path.dirname(directory) === directory) {
			throw new Error(`No react/package.json in any node_modules from ${workspace} up: the workspace does not install React.`);
		}
	}
}
