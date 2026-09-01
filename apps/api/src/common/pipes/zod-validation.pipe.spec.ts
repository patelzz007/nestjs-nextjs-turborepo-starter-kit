import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { AssignRoleToUserSchema, AdminUserListQuerySchema, apiContract } from "@workspace/shared";

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

	it("validates uuid format from z.uuid() schemas", () => {
		const pipe = new ZodValidationPipe(AssignRoleToUserSchema);
		const payload = { userId: "550e8400-e29b-41d4-a716-446655440000", roleId: "550e8400-e29b-41d4-a716-446655440001" };

		expect(pipe.transform(payload)).toEqual(payload);
	});

	it("accepts admin user list query with sort and search", () => {
		const pipe = new ZodValidationPipe(AdminUserListQuerySchema);

		expect(pipe.transform({ page: "1", limit: "20", sort: "fullName" })).toEqual({ page: 1, limit: 20, sort: "fullName" });
		expect(pipe.transform({ page: "1", limit: "20", search: "jane" })).toEqual({ page: 1, limit: 20, search: "jane" });
	});

	it("accepts admin user list query through apiContract input", () => {
		const pipe = new ZodValidationPipe(apiContract.auth.adminUsers.input);

		expect(pipe.transform({ page: "1", limit: "20", sort: "fullName" })).toEqual({ page: 1, limit: 20, sort: "fullName" });
	});
});
