import { JsonObjectSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { zodStandardSchemaConverter, zodToOpenApi } from "./zod-openapi-schema";

describe("zodToOpenApi", () => {
	it("documents the INPUT shape: required keys, types, formats, bounds, enums and nullability", () => {
		const schema = z
			.object({
				email: z.email(),
				name: z.string().min(2).max(50),
				age: z.number().int().min(18),
				role: z.enum(["ADMIN", "MEMBER"]),
				nickname: z.string().nullable(),
				page: z.number().int().default(1),
				note: z.string().optional(),
			})
			.strict();

		const converted = zodToOpenApi(schema).schema;

		// toMatchObject: subset match per property (zod adds e.g. the email `pattern`); arrays match exactly.
		expect(converted).toMatchObject({
			type: "object",
			properties: {
				email: { type: "string", format: "email" },
				name: { type: "string", minLength: 2, maxLength: 50 },
				age: { type: "integer", minimum: 18 },
				role: { type: "string", enum: ["ADMIN", "MEMBER"] },
				nickname: { type: "string", nullable: true },
				page: { type: "integer", default: 1 },
				note: { type: "string" },
			},
			// `.default()` and `.optional()` keys are optional on the wire.
			required: ["email", "name", "age", "role", "nickname"],
			additionalProperties: false,
		});
		expect("$ref" in converted ? [] : Object.keys(converted.properties ?? {})).toEqual(["email", "name", "age", "role", "nickname", "page", "note"]);
	});

	it("carries .describe() and .meta({ description, example }) into the schema", () => {
		const schema = z.object({
			email: z.string().meta({ description: "Login email", example: "admin@example.com" }),
			code: z.string().describe("One-time code"),
			tags: z.array(z.string()).meta({ examples: [["a", "b"]] }),
		});

		expect(zodToOpenApi(schema).schema).toMatchObject({
			properties: {
				email: { description: "Login email", example: "admin@example.com" },
				code: { description: "One-time code" },
				// OpenAPI 3.0 schemas take a single `example`: the first of `examples`.
				tags: { type: "array", items: { type: "string" }, example: ["a", "b"] },
			},
		});
	});

	it("normalises 3.0-isms: const → enum, exclusive bounds → boolean form", () => {
		const schema = z.object({ kind: z.literal("x"), ratio: z.number().gt(0).lt(1) });

		expect(zodToOpenApi(schema).schema).toMatchObject({
			properties: {
				kind: { enum: ["x"] },
				ratio: { type: "number", minimum: 0, exclusiveMinimum: true, maximum: 1, exclusiveMaximum: true },
			},
		});
	});

	it("strips JSON-Schema keywords OpenAPI 3.0 does not understand", () => {
		const serialized: string = JSON.stringify(zodToOpenApi(z.object({ labels: z.record(z.string().min(1), z.number()) })).schema);

		expect(serialized).not.toContain("$schema");
		expect(serialized).not.toContain("propertyNames");
		expect(serialized).toContain('"additionalProperties":{"type":"number"}');
	});

	it("documents a tuple as an array of its positions", () => {
		expect(zodToOpenApi(z.tuple([z.string(), z.number()])).schema).toEqual({
			type: "array",
			items: { anyOf: [{ type: "string" }, { type: "number" }] },
			minItems: 2,
			maxItems: 2,
		});
	});

	it("lifts recursive schemas into components with deterministic names and rewritten $refs", () => {
		const schema = z.object({ payload: JsonObjectSchema });
		const first = zodToOpenApi(schema);
		const second = zodToOpenApi(schema);
		const names: readonly string[] = Object.keys(first.components);

		expect(names.length).toBeGreaterThan(0);
		for (const name of names) {
			expect(name).toMatch(/^ZodSchema_[0-9a-f]{12}$/);
		}
		// Same schema → same component names, so repeated conversions share components.
		expect(Object.keys(second.components)).toEqual(names);
		const serialized: string = JSON.stringify(first);
		expect(serialized).not.toContain("#/definitions/");
		expect(serialized).not.toContain("__schema");
		for (const match of serialized.matchAll(/"#\/components\/schemas\/(?<name>[^"]+)"/g)) {
			expect(names).toContain(match.groups?.name);
		}
	});

	it("gives DIFFERENT recursive schemas different component names", () => {
		interface Tree {
			readonly children: readonly Tree[];
		}
		const TreeSchema: z.ZodType<Tree> = z.lazy(() => z.object({ children: z.array(TreeSchema) }));
		const treeNames: readonly string[] = Object.keys(zodToOpenApi(z.object({ tree: TreeSchema })).components);
		const jsonNames: readonly string[] = Object.keys(zodToOpenApi(z.object({ payload: JsonObjectSchema })).components);

		expect(treeNames.length).toBeGreaterThan(0);
		expect(treeNames.filter((name: string): boolean => jsonNames.includes(name))).toEqual([]);
	});

	it("keeps a .meta({ id }) schema as a named component", () => {
		const Address = z.object({ city: z.string() }).meta({ id: "ProbeAddress" });
		const conversion = zodToOpenApi(z.object({ home: Address, work: Address.optional() }));

		expect(conversion.components).toEqual({ ProbeAddress: { type: "object", properties: { city: { type: "string" } }, required: ["city"] } });
		expect(conversion.schema).toMatchObject({ properties: { home: { $ref: "#/components/schemas/ProbeAddress" } } });
	});

	it("describes the OUTPUT side when asked (a defaulted key is always present in a response)", () => {
		const schema = z.object({ page: z.number().default(1) });

		expect(zodToOpenApi(schema, "input").schema).not.toHaveProperty("required");
		expect(zodToOpenApi(schema, "output").schema).toMatchObject({ required: ["page"] });
	});

	it("documents the OUTPUT shape of a response as an open object (defaults required, no closed-object marker)", () => {
		const schema = z.object({
			id: z.uuid(),
			page: z.number().int().default(1),
			tags: z.record(z.string(), z.number()),
			nested: z.object({ ok: z.boolean() }).strict(),
		});

		const serialized: string = JSON.stringify(zodToOpenApi(schema, "output").schema);

		expect(zodToOpenApi(schema, "output").schema).toMatchObject({ type: "object", required: ["id", "page", "tags", "nested"] });
		// Responses never say "closed": a client must ignore fields the API adds later (ADR 022) …
		expect(serialized).not.toContain('"additionalProperties":false');
		// … while record value schemas survive.
		expect(serialized).toContain('"additionalProperties":{"type":"number"}');
		// Request bodies keep the marker: a `.strict()` input really rejects unknown keys.
		expect(JSON.stringify(zodToOpenApi(schema, "input").schema)).toContain('"additionalProperties":false');
	});

	it("rejects a self-referencing ROOT schema instead of emitting a dangling $ref", () => {
		interface Node {
			readonly next?: Node | undefined;
		}
		const NodeSchema: z.ZodType<Node> = z.object({ next: z.lazy(() => NodeSchema).optional() });

		expect(() => zodToOpenApi(NodeSchema)).toThrow(/self-referencing root schema/);
	});
});

describe("zodStandardSchemaConverter", () => {
	it("converts zod schemas for @nestjs/swagger and declines anything else", () => {
		expect(zodStandardSchemaConverter(z.object({ id: z.uuid() }), { schemaType: "input" })).toMatchObject({
			schema: { type: "object", required: ["id"] },
			components: {},
		});
		expect(zodStandardSchemaConverter({ "~standard": { version: 1, vendor: "other" } }, { schemaType: "input" })).toBeUndefined();
	});
});
