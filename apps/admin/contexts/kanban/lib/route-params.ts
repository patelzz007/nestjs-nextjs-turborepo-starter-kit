import "server-only";

import { KanbanTaskPathSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

/** Dynamic route params as Next.js passes them. */
export interface KanbanTaskRouteParams {
	readonly params: Promise<{ readonly id: string }>;
}

/** The `[id]` of a task page, validated with the API's own path schema; anything else is a 404 (never an API call with a malformed id). */
export async function readKanbanTaskIdParam({ params }: KanbanTaskRouteParams): Promise<string> {
	const parsed = KanbanTaskPathSchema.safeParse({ taskId: (await params).id });
	return parsed.success ? parsed.data.taskId : notFound();
}
