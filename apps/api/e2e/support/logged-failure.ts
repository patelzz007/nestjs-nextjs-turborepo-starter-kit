// A failure a component logged and carried on from (`logger.error({ event, ...caughtErrorLogFields(error) })`,
// src/platform/application/errors/caught-error-log.ts), read back from the logger spy with its types:
// a test asserts the event, the message and that the stack came with it.

import { LIST_SLOT_INDEX } from "@workspace/shared";
import type { MockInstance } from "vitest";
import { z } from "zod";

/** The logged object: the event, the error's message and its stack, plus a correlation id when the line carries one. */
export const LoggedFailureSchema = z.object({
	event: z.string(),
	error: z.string(),
	stack: z.string(),
	correlationId: z.string().optional(),
});

export type LoggedFailure = z.output<typeof LoggedFailureSchema>;

/** The first failure `spy` (a `Logger.prototype.error` spy) logged; throws when it logged none, or no failure object. */
export function firstLoggedFailure(spy: MockInstance): LoggedFailure {
	return LoggedFailureSchema.parse(spy.mock.calls.at(LIST_SLOT_INDEX.first)?.at(LIST_SLOT_INDEX.first));
}
