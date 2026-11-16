import { JsonValueSchema } from "@workspace/shared";
import type { z } from "zod";

/** Text → a checked JSON value, so `JSON.parse`'s untyped result goes no further than this line. Throws on invalid JSON. */
export function parseJson(text: string): z.output<typeof JsonValueSchema> {
	return JsonValueSchema.parse(JSON.parse(text));
}
