import { parse } from "yaml";
import { z } from "zod";

const StringMapSchema = z.record(z.string(), z.string());

/** The parts of a `package.json` the guard tests read. */
const PackageManifestSchema = z.looseObject({
	name: z.string().optional(),
	version: z.string().optional(),
	packageManager: z.string().optional(),
	engines: z.looseObject({ node: z.string().optional() }).optional(),
	scripts: StringMapSchema.optional(),
	dependencies: StringMapSchema.optional(),
});

/** A step of a GitHub workflow job: `env` values may be numbers or booleans in YAML. */
const WorkflowStepSchema = z.looseObject({
	name: z.string().optional(),
	run: z.string().optional(),
	env: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const WorkflowJobSchema = z.looseObject({
	env: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
	steps: z.array(WorkflowStepSchema).optional(),
	strategy: z.looseObject({ matrix: z.looseObject({ include: z.array(z.looseObject({})).optional() }).optional() }).optional(),
});

const WorkflowSchema = z.looseObject({ jobs: z.record(z.string(), WorkflowJobSchema) });

/** `eas.json`: the profiles the mobile guard tests compare. */
const EasConfigSchema = z.looseObject({
	build: z.record(
		z.string(),
		z.looseObject({
			extends: z.string().optional(),
			environment: z.string().optional(),
			node: z.string().optional(),
			pnpm: z.string().optional(),
			env: StringMapSchema.optional(),
		}),
	),
});

/** One step of a workflow job. */
export type WorkflowStep = z.output<typeof WorkflowStepSchema>;

/** A `package.json`'s text, parsed. */
export function packageManifest(text: string): z.output<typeof PackageManifestSchema> {
	return PackageManifestSchema.parse(JSON.parse(text));
}

/** A GitHub workflow's YAML, parsed. */
export function workflow(text: string): z.output<typeof WorkflowSchema> {
	return WorkflowSchema.parse(parse(text));
}

/** An `eas.json`'s text, parsed. */
export function easConfig(text: string): z.output<typeof EasConfigSchema> {
	return EasConfigSchema.parse(JSON.parse(text));
}

/** A CommonJS module's exports: checked to be an object, typed by what the test calls of it. */
export function moduleSchema<TModule extends object>(): z.ZodCustom<TModule> {
	return z.custom<TModule>((value) => z.looseObject({}).safeParse(value).success);
}
