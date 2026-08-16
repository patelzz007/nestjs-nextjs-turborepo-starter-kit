import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { ZodValidationPipe } from "./zod-validation.pipe";

const TestSchema = z
	.object({
		email: z.string().email(),
		password: z.string().min(8),
	})
	.strict();

describe("ZodValidationPipe (compiled ajv)", () => {
	it("passes a valid payload through unchanged", () => {
		const pipe = new ZodValidationPipe(TestSchema);
		const payload = { email: "admin@example.com", password: "hunter2!" };

		expect(pipe.transform(payload)).toEqual(payload);
	});

	it("rejects an invalid payload with the structured { message, errors } shape", () => {
		const pipe = new ZodValidationPipe(TestSchema);

		try {
			pipe.transform({ email: "not-an-email", password: "short" });
			throw new Error("Expected transform to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(BadRequestException);
			const body = (error as BadRequestException).getResponse() as {
				readonly message: string;
				readonly errors: readonly { readonly path: string; readonly message: string }[];
			};
			expect(body.message).toBe("Validation failed");
			expect(body.errors.length).toBeGreaterThan(0);
			expect(body.errors.map((issue) => issue.path)).toEqual(expect.arrayContaining(["email", "password"]));
		}
	});

	it("rejects unknown keys on a .strict() schema", () => {
		const pipe = new ZodValidationPipe(TestSchema);

		try {
			pipe.transform({ email: "a@b.com", password: "longenough", extra: 1 });
			throw new Error("Expected transform to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(BadRequestException);
		}
	});

	it("caches the compiled validator (same instance across calls)", () => {
		const pipe = new ZodValidationPipe(TestSchema);
		const first = pipe.transform({ email: "a@b.com", password: "longenough!" });
		const second = pipe.transform({ email: "c@d.com", password: "alsoenough!" });

		expect(first).toEqual({ email: "a@b.com", password: "longenough!" });
		expect(second).toEqual({ email: "c@d.com", password: "alsoenough!" });
	});
});
