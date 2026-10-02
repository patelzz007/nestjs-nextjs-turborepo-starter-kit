import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { AssignRoleToUserSchema, AdminUserListQuerySchema, apiContract, JsonValueSchema, type JsonValue } from "@workspace/shared";
import { toJSONSchema } from "zod/v4";

import { collectSchemas } from "../ajv-warmup";
import { AJV_STRING_FORMATS, ZodValidationPipe } from "./zod-validation.pipe";

const ValidationErrorBodySchema = z.object({
	message: z.string(),
	errors: z.array(z.object({ path: z.string(), message: z.string() })),
});

const TestSchema = z
	.object({
		email: z.email(),
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
			if (!(error instanceof BadRequestException)) {
				throw error;
			}
			const body = ValidationErrorBodySchema.parse(error.getResponse());
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

	it("enforces the uri format from z.url() exactly like Zod (it is not skipped)", () => {
		const pipe = new ZodValidationPipe(z.object({ href: z.url() }).strict());

		expect(pipe.transform({ href: "https://example.com/invite?token=abc" })).toEqual({ href: "https://example.com/invite?token=abc" });
		expect(() => pipe.transform({ href: "not a url" })).toThrow(BadRequestException);
	});

	it("has a registered validator for every JSON Schema format the apiContract emits", () => {
		const emitted = new Set<string>();
		const collectFormats = (node: JsonValue): void => {
			if (Array.isArray(node)) {
				node.forEach(collectFormats);
				return;
			}
			if (node === null || typeof node !== "object") {
				return;
			}
			const format = node.format;
			if (typeof format === "string") {
				emitted.add(format);
			}
			Object.values(node).forEach(collectFormats);
		};
		for (const schema of collectSchemas(apiContract)) {
			const converted = JsonValueSchema.safeParse(toJSONSchema(schema, { unrepresentable: "any" }));
			if (converted.success) {
				collectFormats(converted.data);
			}
		}

		expect(emitted.size).toBeGreaterThan(0);
		expect([...emitted].filter((format: string): boolean => !(format in AJV_STRING_FORMATS))).toEqual([]);
	});
});
