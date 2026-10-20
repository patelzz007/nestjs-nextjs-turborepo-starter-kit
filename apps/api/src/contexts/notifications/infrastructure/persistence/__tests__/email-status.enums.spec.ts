import { $Enums } from "@prisma/client";
import { DeliveryEventOutcomeSchema, EmailLogStatusSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

/**
 * The email status / delivery-outcome value lists exist twice by necessity:
 * as zod enums in @workspace/shared (the API contract, usable by the frontends)
 * and as Prisma enums in schema.prisma (the database type). This spec is the
 * guard that keeps them ONE list — adding a value to either side fails here.
 */
describe("email enums: shared contract ↔ Prisma schema", () => {
	it("EmailLogStatusSchema lists exactly the Prisma EmailLogStatus values", () => {
		expect([...EmailLogStatusSchema.options].sort()).toEqual(Object.values($Enums.EmailLogStatus).sort());
	});

	it("DeliveryEventOutcomeSchema lists exactly the Prisma EmailDeliveryOutcome values", () => {
		expect([...DeliveryEventOutcomeSchema.options].sort()).toEqual(Object.values($Enums.EmailDeliveryOutcome).sort());
	});
});
