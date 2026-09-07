import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import type { GeneratorModule } from "../schema/generator-modules";
import { EXCLUDED_GENERATOR_APP_IDS } from "../schema/generator-modules";

function normalizeRepoRelativePath(relativePath: string): string {
	return relativePath.split(path.sep).join("/");
}

function findSidebarMenuRelativePath(rootDir: string, appDir: string, appId: string): string | null {
	const candidates = [
		path.join(appDir, "lib", "navigation", "sidebar-menu.json"),
		path.join(appDir, "data", `${appId}-sidebar-menu.json`),
		path.join(appDir, "data", "user-sidebar-menu.json"),
	];

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return normalizeRepoRelativePath(path.relative(rootDir, candidate));
		}
	}

	const dataDir = path.join(appDir, "data");
	if (existsSync(dataDir)) {
		const entries = readdirSync(dataDir);
		const sidebarJson = entries.find((entry) => entry.includes("sidebar") && entry.endsWith(".json"));
		if (sidebarJson !== undefined) {
			return normalizeRepoRelativePath(path.join("apps", appId, "data", sidebarJson));
		}
	}

	return null;
}

function resolveRouteLayout(rootDir: string, appId: string): Pick<GeneratorModule, "routePrefix" | "panelSegment" | "resourceRouteTemplate"> | null {
	const appDir = path.join(rootDir, "apps", appId);
	const panelDir = path.join(appDir, "app", "(panel)");
	if (existsSync(panelDir)) {
		return {
			routePrefix: "",
			panelSegment: "(panel)",
			resourceRouteTemplate: `apps/${appId}/app/(panel)/{slug}`,
		};
	}

	const rewardhubDir = path.join(appDir, "app", "rewardhub");
	if (existsSync(rewardhubDir)) {
		return {
			routePrefix: "/rewardhub",
			panelSegment: null,
			resourceRouteTemplate: `apps/${appId}/app/rewardhub/{slug}`,
		};
	}

	return null;
}

function discoverModuleFromApp(rootDir: string, appId: string): GeneratorModule | null {
	if (EXCLUDED_GENERATOR_APP_IDS.includes(appId)) {
		return null;
	}

	const appDir = path.join(rootDir, "apps", appId);
	if (!existsSync(appDir)) {
		return null;
	}

	const routeLayout = resolveRouteLayout(rootDir, appId);
	if (routeLayout === null) {
		return null;
	}

	const sidebarMenuPath = findSidebarMenuRelativePath(rootDir, appDir, appId);
	if (sidebarMenuPath === null) {
		return null;
	}

	return {
		id: appId,
		appDir: `apps/${appId}`,
		routePrefix: routeLayout.routePrefix,
		panelSegment: routeLayout.panelSegment,
		sidebarMenuPath,
		resourceRouteTemplate: routeLayout.resourceRouteTemplate,
	};
}

export function discoverGeneratorModules(rootDir: string): GeneratorModule[] {
	const appsDir = path.join(rootDir, "apps");
	if (!existsSync(appsDir)) {
		return [];
	}

	const appIds = readdirSync(appsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((appId) => !EXCLUDED_GENERATOR_APP_IDS.includes(appId))
		.sort((left, right) => left.localeCompare(right));

	const modules: GeneratorModule[] = [];
	for (const appId of appIds) {
		const module = discoverModuleFromApp(rootDir, appId);
		if (module !== null) {
			modules.push(module);
		}
	}

	return modules;
}

export function resolveModuleResourceDir(module: GeneratorModule, slug: string): string {
	return module.resourceRouteTemplate.replace("{slug}", slug);
}

export function findGeneratorModule(modules: readonly GeneratorModule[], moduleId: string): GeneratorModule | undefined {
	return modules.find((module) => module.id === moduleId);
}
