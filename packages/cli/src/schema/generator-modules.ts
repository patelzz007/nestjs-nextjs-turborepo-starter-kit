import { z } from "zod";

export const GeneratorModuleSchema = z
	.object({
		id: z.string().min(1),
		appDir: z.string().min(1),
		routePrefix: z.string(),
		panelSegment: z.string().nullable(),
		sidebarMenuPath: z.string().min(1),
		resourceRouteTemplate: z.string().min(1),
	})
	.strict();

export type GeneratorModule = z.output<typeof GeneratorModuleSchema>;

export const GeneratorModulesManifestSchema = z
	.object({
		version: z.literal(1),
		modules: z.array(GeneratorModuleSchema).min(1),
	})
	.strict();

export type GeneratorModulesManifest = z.output<typeof GeneratorModulesManifestSchema>;

export const GENERATOR_MODULES_MANIFEST_RELATIVE_PATH = ".app/generator-modules.json";

export const EXCLUDED_GENERATOR_APP_IDS: readonly string[] = ["api", "docs", "analytics-consumer"];
