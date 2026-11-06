import { parseEnvOrThrow } from "@workspace/shared";
import type { z } from "zod";

/**
 * Parses one scope of a Next.js app's environment, once, at module load. A missing or malformed value
 * fails the build or the server start with a named error instead of surfacing later as a broken request.
 *
 * `values` must name every key of the schema, so a schema variable nobody reads fails to compile. The
 * caller writes each one as a literal `process.env.X`: Next.js inlines `NEXT_PUBLIC_*` at build time only
 * for that exact form, and a dynamic lookup reads `undefined` in the browser. That is why the reads stay
 * in each app's `env.client.ts` / `env.server.ts` and only the parsing is here.
 */
export function parseAppEnv<TSchema extends z.ZodObject>(
	schema: TSchema,
	values: Readonly<Record<keyof z.input<TSchema>, string | undefined>>,
	scope: string,
): Readonly<z.output<TSchema>> {
	return parseEnvOrThrow(schema, values, scope);
}
