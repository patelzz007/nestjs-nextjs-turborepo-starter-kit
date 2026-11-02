import "server-only";

import { BroadcastIdParamsSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

/** Dynamic route params as Next.js passes them. */
export interface IdRouteParams {
	readonly params: Promise<{ readonly id: string }>;
}

/** The `[id]` of a broadcast page, validated with the API's own param schema; anything else is a 404. */
export async function readBroadcastIdParam({ params }: IdRouteParams): Promise<string> {
	const parsed = BroadcastIdParamsSchema.safeParse({ broadcastId: (await params).id });
	return parsed.success ? parsed.data.broadcastId : notFound();
}
