// The project's identity (project.json at the repository root): its slug (package name, Docker
// project and container names, service ids) and its display name (what every app calls itself).
// project.json is the one place to change; this module writes it into every file that can't read it
// at runtime, and reports any copy that has drifted.

import { z } from "zod";
import { toolingConfig } from "../../../../tooling.config.ts";

/** Lower-case letters, digits and single dashes; starts with a letter (npm, Docker and Redis all accept it). */
const SLUG_PATTERN = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,38}$/u;
/** The phone app's store name is capped at 30 characters (apps/mobile/build-env/app-config-env.ts). */
const DISPLAY_NAME_MAX_LENGTH = 30;

export const ProjectIdentitySchema = z
	.object({
		$comment: z.string().optional(),
		slug: z.string().regex(SLUG_PATTERN, "must be 2–39 lower-case letters, digits and single dashes, starting with a letter"),
		displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH),
	})
	.strict();

export type ProjectIdentity = z.output<typeof ProjectIdentitySchema>;

export interface IdentityTarget {
	readonly path: string;
	readonly render: (current: string, identity: ProjectIdentity) => string;
}

export function parseProjectIdentity(json: string): { $comment?: string | undefined; slug: string; displayName: string } {
	return ProjectIdentitySchema.parse(JSON.parse(json));
}

/**
 * Replaces the one line `pattern` matches with `replacement`; throws when the line is missing, so a
 * moved or renamed anchor fails the check loudly instead of silently skipping the file.
 * @param text @param {RegExp} pattern @param {(match: RegExpExecArray) => string} replacement @param {string} where
 */

function replaceLine(text: string, pattern: RegExp, replacement: (match: RegExpExecArray) => string, where: string): string {
	const match = pattern.exec(text);
	if (match === null) {
		throw new Error(`${where}: the line ${String(pattern)} was not found; restore it or update packages/tooling/src/project-identity/project-identity.ts`);
	}
	return text.replace(pattern, replacement(match));
}

/** The root package's `name` (the first `"name"` key, which is the top-level one). */
export function renderRootPackageJson(current: string, identity: ProjectIdentity): string {
	return replaceLine(current, /^(?<indent>\t| +)"name": "[^"]*",$/mu, (match) => `${match.groups?.indent ?? "\t"}"name": "${identity.slug}",`, "package.json");
}

const COMPOSE_SERVICE_LINE = /^ {2}(?:# )?(?<service>[a-z][a-z0-9-]*):\s*$/u;
const COMPOSE_CONTAINER_LINE = /^(?<lead>\s*(?:#\s*)?)container_name: \S+\s*$/u;
const COMPOSE_NETWORK_NAME_LINE = /^(?<lead> {4})name: \S+-(?<network>[a-z0-9]+)\s*$/u;

/**
 * compose.yml: the Compose project name, every `container_name` (`<slug>-<service>`, commented-out
 * services included) and the named network (`<slug>-<network>`).
 */
export function renderCompose(current: string, identity: ProjectIdentity): string {
	let service: string | null = null;
	let inNetworks = false;
	const found = new Set<string>();
	const lines = current.split("\n").map((line) => {
		if (line.startsWith("name: ")) {
			found.add("project name");
			return `name: ${identity.slug}`;
		}
		if (/^[a-z]/u.test(line)) {
			inNetworks = line.startsWith("networks:");
			service = null;
		}
		const serviceMatch = COMPOSE_SERVICE_LINE.exec(line);
		if (serviceMatch !== null) {
			service = serviceMatch.groups?.service ?? null;
			return line;
		}
		const container = COMPOSE_CONTAINER_LINE.exec(line);
		if (container !== null && service !== null) {
			return `${container.groups?.lead ?? ""}container_name: ${identity.slug}-${service}`;
		}
		const network = inNetworks ? COMPOSE_NETWORK_NAME_LINE.exec(line) : null;
		if (network !== null) {
			return `${network.groups?.lead ?? ""}name: ${identity.slug}-${network.groups?.network ?? "infra"}`;
		}
		return line;
	});
	if (!found.has("project name")) {
		throw new Error("compose.yml: the top-level `name:` line was not found");
	}
	return lines.join("\n");
}

/** apps/api/.env.example: the documented APP_NAME and OBSERVE_SERVICE_ID. */
export function renderApiEnvExample(current: string, identity: ProjectIdentity): string {
	const named = replaceLine(current, /^APP_NAME=.*$/mu, () => `APP_NAME=${identity.displayName}`, `${toolingConfig.folders.api}/.env.example`);
	return replaceLine(named, /^OBSERVE_SERVICE_ID=.*$/mu, () => `OBSERVE_SERVICE_ID=${identity.slug}`, `${toolingConfig.folders.api}/.env.example`);
}

/** apps/mobile/build-env/app-config-env.ts: the store name used when MOBILE_APP_NAME is unset. */
export function renderMobileAppConfig(current: string, identity: ProjectIdentity): string {
	return replaceLine(
		current,
		/^(?<head>\tMOBILE_APP_NAME: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(APP_NAME_MAX_LENGTH\)\.default\()"[^"]*"(?<tail>\),)$/mu,
		(match) => `${match.groups?.head ?? ""}${JSON.stringify(identity.displayName)}${match.groups?.tail ?? ""}`,
		`${toolingConfig.folders.mobile}/build-env/app-config-env.ts`,
	);
}

/** packages/tokens/src/project-identity.ts: the identity as TypeScript, for every app's code. */
export function renderTokensModule(_current: string, identity: ProjectIdentity): string {
	return [
		"// GENERATED from project.json by `pnpm project:sync` — do not edit; edit project.json instead.",
		"",
		"/** The project's slug: package, Docker and service names. */",
		`export const PROJECT_SLUG = ${JSON.stringify(identity.slug)};`,
		"",
		"/** The product's display name: what every app calls itself. */",
		`export const PROJECT_DISPLAY_NAME = ${JSON.stringify(identity.displayName)};`,
		"",
	].join("\n");
}

/** Every file that holds a copy of the identity, relative to the repository root. @type {readonly IdentityTarget[]} */
export const IDENTITY_TARGETS = [
	{ path: "package.json", render: renderRootPackageJson },
	{ path: "compose.yml", render: renderCompose },
	{ path: `${toolingConfig.folders.api}/.env.example`, render: renderApiEnvExample },
	{ path: `${toolingConfig.folders.mobile}/build-env/app-config-env.ts`, render: renderMobileAppConfig },
	{ path: `${toolingConfig.folders.tokens}/src/project-identity.ts`, render: renderTokensModule },
];

/**
 * The targets whose content differs from what the identity renders.
 * @param read returns "" for a missing file
 */

export function driftedTargets(identity: ProjectIdentity, read: (path: string) => string): { readonly path: string; readonly next: string }[] {
	return IDENTITY_TARGETS.flatMap((target) => {
		const current = read(target.path);
		const next = target.render(current, identity);
		return next === current ? [] : [{ path: target.path, next }];
	});
}
