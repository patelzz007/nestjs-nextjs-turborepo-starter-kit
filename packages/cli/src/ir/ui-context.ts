import type { GeneratorModule } from "../schema/generator-modules";
import type { ResourceIR, UiTargetIR } from "./types";

export interface ActiveUiContext {
	readonly moduleId: string;
	readonly routePrefix: string;
}

export function withActiveUiModule(ir: ResourceIR, module: GeneratorModule): ResourceIR {
	const target = ir.uiTargets[module.id];
	if (target === undefined) {
		throw new Error(`Resource "${ir.resource.slug}" has no UI config for module "${module.id}".`);
	}
	return {
		...ir,
		admin: target,
		activeUi: {
			moduleId: module.id,
			routePrefix: module.routePrefix,
		},
	};
}

export function resolveUiResourceBasePath(ir: ResourceIR): string {
	const prefix = ir.activeUi?.routePrefix ?? "";
	const slug = ir.resource.slug;
	return prefix.length > 0 ? `${prefix}/${slug}` : `/${slug}`;
}

export function buildUiTargetIR(
	moduleId: string,
	config: {
		readonly navigation?: UiTargetIR["navigation"];
		readonly list: UiTargetIR["list"];
		readonly form: UiTargetIR["form"];
	},
): UiTargetIR {
	return {
		moduleId,
		navigation: config.navigation,
		list: config.list,
		form: config.form,
	};
}
