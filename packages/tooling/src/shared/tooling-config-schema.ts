import { z } from "zod";

const PortSchema = z.number().int().min(1).max(65_535);
const FolderSchema = z.string().min(1);

const ToolSchema = z.object({ name: z.string().min(1), group: z.string().min(1), description: z.string().min(1), command: z.string().min(1) }).strict();

const DeployAppSchema = z.object({ app: z.string().min(1), workspace: z.string().min(1), port: PortSchema, healthPath: z.string().min(1) }).strict();

/**
 * The shape of the repository's `tooling.config.ts`: every app name, port and path the tools need. The tools
 * themselves hold none of these, so a product built from this starter changes that one file, not tool code.
 */
export const ToolingConfigSchema = z
	.object({
		/** The file holding the project's name, read by the identity and CI-env tools. */
		projectFile: FolderSchema,
		workspaces: z.record(z.string(), z.string().min(1)),
		folders: z.record(z.string(), FolderSchema),
		ports: z.record(z.string(), PortSchema),
		nextApps: z.array(z.string().min(1)).min(1),
		budgets: z.object({ bundle: FolderSchema, load: FolderSchema, mobileStartup: FolderSchema }).strict(),
		artifacts: z.object({ ci: FolderSchema, devTiming: FolderSchema, logs: FolderSchema, playwright: FolderSchema }).strict(),
		migrations: z.object({ directory: FolderSchema, baselineFile: FolderSchema }).strict(),
		envExampleFiles: z.array(FolderSchema).min(1),
		testPlacementWorkspaces: z.array(FolderSchema).min(1),
		deploy: z.object({ apps: z.array(DeployAppSchema).min(1), pm2Ecosystem: FolderSchema }).strict(),
		tools: z.array(ToolSchema).min(1),
	})
	.strict();

/** The repository's tooling settings. */
export type ToolingConfig = z.output<typeof ToolingConfigSchema>;
