import { z } from "zod";
import { toJSONSchema } from "zod/v4";
import { describe, expect, it } from "vitest";

import { JsonValueSchema } from "@workspace/shared";

import { nullableAsTypeLists } from "../json-schema-nullable";
import { ZodValidationPipe } from "../zod-validation.pipe";

describe("nullableAsTypeLists", () => {
	it("folds a nullable number, string, enum and literal into type lists, keeping their rules", () => {
		const schema = z.object({
			dueAt: z.number().int().min(0).nullable(),
			name: z.string().max(3).nullable(),
			status: z.enum(["OPEN", "DONE"]).nullable(),
			points: z.literal([1, 2, 3]).nullable(),
			only: z.literal("x").nullable(),
		});

		expect(nullableAsTypeLists(JsonValueSchema.parse(toJSONSchema(schema)))).toMatchObject({
			properties: {
				dueAt: { type: ["integer", "null"], minimum: 0 },
				name: { type: ["string", "null"], maxLength: 3 },
				status: { type: ["string", "null"], enum: ["OPEN", "DONE", null] },
				points: { type: ["number", "null"], enum: [1, 2, 3, null] },
				only: { type: ["string", "null"], enum: ["x", null] },
			},
		});
	});

	it("leaves every other union alone", () => {
		const union = { anyOf: [{ type: "string" }, { type: "number" }] };
		const nullableObject = { anyOf: [{ anyOf: [{ type: "string" }, { type: "number" }] }, { type: "null" }] };

		expect(nullableAsTypeLists(union)).toEqual(union);
		expect(nullableAsTypeLists(nullableObject)).toEqual({ anyOf: [union, { type: "null" }] });
	});
});

describe("ZodValidationPipe with nullable fields", () => {
	const Schema = z
		.object({
			dueAt: z.number().int().nullable(),
			startAt: z.number().int().nullable().default(null),
			title: z.string().nullable(),
			flag: z.boolean().nullable(),
			limit: z.number().int(),
		})
		.strict();

	it("keeps an explicit or defaulted null as null instead of coercing it to 0, '' or false", () => {
		const pipe = new ZodValidationPipe(Schema);

		expect(pipe.transform({ dueAt: null, title: null, flag: null, limit: 5 })).toEqual({ dueAt: null, startAt: null, title: null, flag: null, limit: 5 });
	});

	it("still coerces a query-string number and accepts a real value", () => {
		const pipe = new ZodValidationPipe(Schema);

		expect(pipe.transform({ dueAt: "7", title: "x", flag: true, limit: "5" })).toEqual({ dueAt: 7, startAt: null, title: "x", flag: true, limit: 5 });
	});
});
