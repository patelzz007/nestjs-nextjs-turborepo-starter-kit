import "server-only";

import { ProductIdParamSchema, SampleCategoryIdParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

/** Dynamic route params as Next.js passes them. */
export interface IdRouteParams {
	readonly params: Promise<{ readonly id: string }>;
}

/** The `[id]` of a product page, validated with the API's own param schema; anything else is a 404 (never an API call with a malformed id). */
export async function readProductIdParam({ params }: IdRouteParams): Promise<string> {
	const parsed = ProductIdParamSchema.safeParse(await params);
	return parsed.success ? parsed.data.id : notFound();
}

/** The `[id]` of a category page, validated with the API's own param schema; anything else is a 404. */
export async function readCategoryIdParam({ params }: IdRouteParams): Promise<string> {
	const parsed = SampleCategoryIdParamSchema.safeParse(await params);
	return parsed.success ? parsed.data.id : notFound();
}
