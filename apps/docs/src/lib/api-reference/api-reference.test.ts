import { describe, expect, it } from "vitest";

import { extractEndpointAccess } from "./endpoint-access";
import { ApiSamplesFileSchema, isCapturedSample, listEndpoints, OpenApiDocumentSchema, type Endpoint } from "./openapi";
import { pageForTags, REFERENCE_PAGES } from "./pages";
import { accessLines, endpointHeading, headingAnchor, renderApiReference } from "./render";
import { constraintNotes, resolveSchema, schemaRows, typeLabel } from "./schema-table";

const CONTROLLER = `
@ApiTags("Redemptions")
@SkipMutationIntent()
@Controller(apiPath("/redemptions"))
export class RedemptionsController {
	public constructor(private readonly service: RedemptionService) {}

	@Public()
	@UseGuards(MerchantApiKeyGuard, PosRateLimitGuard)
	@Post("checkout")
	public checkout(
		@MerchantPos() pos: MerchantPosContext,
	): Promise<void> {
		return this.service.checkout(pos);
	}
}

@SuperAdminOnly()
@Controller(apiPath("/admin/roles"))
export class RolesController {
	@RequirePermission("UPDATE", "ROLE")
	@Throttle({ strict: { ttl: 60000, limit: 5 } })
	@Authorize({
		action: "UPDATE",
		resource: "USER",
		resourceId: self(),
		description: "User can only change their own role",
	})
	@Patch(":id")
	public async update(): Promise<void> {}
}
`;

const DOCUMENT = OpenApiDocumentSchema.parse({
	paths: {
		"/api/v1/redemptions/checkout": {
			post: {
				operationId: "RedemptionsController_checkout",
				summary: "POS checkout",
				description: "A reused key with another body is rejected (409 IDEMPOTENCY_KEY_REUSED).",
				tags: ["Redemptions"],
				parameters: [{ name: "X-Terminal-Id", in: "header", required: false, schema: { type: "string" } }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["codes"],
								properties: {
									codes: { type: "array", minItems: 1, maxItems: 10, items: { type: "object", properties: { backupCode: { type: "string", pattern: "^[A-Z2-9]{8}$" } } } },
								},
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Bill recorded",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean" },
										data: { type: "object", required: ["saleId"], properties: { saleId: { type: "string", format: "uuid" } } },
										meta: { type: "object", properties: { correlationId: { type: "string" } } },
									},
								},
							},
						},
					},
					"4XX": { description: "Client error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiErrorResponseDto" } } } },
				},
			},
		},
		"/api/v1/admin/roles/{id}": {
			patch: { operationId: "RolesController_update", tags: ["Roles"], responses: { "200": { description: "Updated" } } },
		},
	},
	components: { schemas: { ApiErrorResponseDto: { type: "object", properties: { success: { type: "boolean" } } } } },
});

const SAMPLES = ApiSamplesFileSchema.parse({
	capturedFrom: "pnpm db:seed (development scenario)",
	capturedAt: 1791072000000,
	samples: {
		RedemptionsController_checkout: {
			as: "machine client (no session)",
			request: { method: "POST", path: "/api/v1/redemptions/checkout", headers: { "X-API-Key": "mk_live_seed" }, body: { codes: [{ backupCode: "ABCD2345" }] } },
			response: { status: 201, contentType: "application/json", body: { success: true, data: { saleId: "s-1" } } },
		},
		RolesController_update: { notCaptured: "Needs a second SuperAdmin." },
	},
});

const ACCESS = extractEndpointAccess([{ path: "apps/api/src/demo.controller.ts", source: CONTROLLER }]);

function endpoint(operationId: string): Endpoint {
	const found = listEndpoints(DOCUMENT).find((candidate) => candidate.operation.operationId === operationId);
	if (found === undefined) throw new Error(`fixture has no ${operationId}`);
	return found;
}

describe("extractEndpointAccess", () => {
	it("keys methods by Controller_method and merges class decorators", () => {
		expect([...ACCESS.keys()].sort()).toEqual(["RedemptionsController_checkout", "RolesController_update"]);
		const checkout = ACCESS.get("RedemptionsController_checkout");
		expect(checkout).toMatchObject({ isPublic: true, merchantApiKey: true, skipsMutationIntent: true, superAdminOnly: false });
	});

	it("reads permissions, multi-line policies and rate limits", () => {
		const update = ACCESS.get("RolesController_update");
		expect(update?.superAdminOnly).toBe(true);
		expect(update?.permissions).toEqual(["UPDATE:ROLE"]);
		expect(update?.policies).toEqual(["UPDATE:USER (own record only) — User can only change their own role"]);
		expect(update?.throttles).toEqual(["5 requests per 60 s per client IP (strict limiter)"]);
	});

	it("does not treat parameter decorators or the constructor as routes", () => {
		expect(ACCESS.has("RedemptionsController_constructor")).toBe(false);
	});
});

describe("schema tables", () => {
	const registry = DOCUMENT.components.schemas;

	it("labels types, formats, enums and nullability", () => {
		expect(typeLabel({ type: "string", format: "uuid" }, registry)).toBe("string (uuid)");
		expect(typeLabel({ enum: ["A", "B"] }, registry)).toBe('"A" | "B"');
		expect(typeLabel({ type: "integer", nullable: true }, registry)).toBe("integer | null");
		expect(typeLabel({ type: "array", items: { type: "string" } }, registry)).toBe("string[]");
		expect(typeLabel({ anyOf: [{ type: "string" }, { type: "number" }] }, registry)).toBe("string | number");
	});

	it("summarizes long enums", () => {
		const members = Array.from({ length: 12 }, (_, index) => `V${String(index)}`);
		expect(typeLabel({ enum: members }, registry)).toContain("(+2 more)");
	});

	it("lists constraints and hides the safe-integer bound", () => {
		expect(constraintNotes({ type: "string", minLength: 8, maxLength: 8, description: "Backup code" }, registry)).toBe("Backup code; exactly 8 characters");
		expect(constraintNotes({ type: "string", minLength: 1, maxLength: 64 }, registry)).toBe("length 1–64");
		expect(constraintNotes({ type: "string", minLength: 1 }, registry)).toBe("at least 1 characters");
		expect(constraintNotes({ type: "string", maxLength: 100 }, registry)).toBe("at most 100 characters");
		expect(constraintNotes({ type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER }, registry)).toBe("");
		expect(constraintNotes({ type: "integer", minimum: 0, maximum: 100 }, registry)).toBe("range 0–100");
	});

	it("flattens nested objects and arrays into dotted rows", () => {
		const requestSchema = endpoint("RedemptionsController_checkout").operation.requestBody?.content["application/json"]?.schema;
		expect(requestSchema).toBeDefined();
		const rows = requestSchema === undefined ? [] : schemaRows(requestSchema, registry);
		expect(rows.map((row) => row.name)).toEqual(["codes", "codes[].backupCode"]);
		expect(rows[0]).toMatchObject({ required: true, notes: "1–10 items" });
	});

	it("resolves $ref against the component registry", () => {
		expect(resolveSchema({ $ref: "#/components/schemas/ApiErrorResponseDto" }, registry).properties).toHaveProperty("success");
	});
});

describe("renderApiReference", () => {
	it("builds GitHub-compatible anchors", () => {
		expect(headingAnchor(endpointHeading(endpoint("RolesController_update")))).toBe("patch-apiv1adminrolesid");
	});

	it("describes the credential each endpoint needs", () => {
		expect(accessLines(endpoint("RedemptionsController_checkout"), ACCESS.get("RedemptionsController_checkout"))[0]).toContain("Merchant API key");
		expect(accessLines(endpoint("RolesController_update"), ACCESS.get("RolesController_update")).join("\n")).toContain("SuperAdmin only");
	});

	it("renders an index plus one page per reference page", () => {
		const files = renderApiReference({ document: DOCUMENT, access: ACCESS, samples: SAMPLES });
		expect([...files.keys()]).toEqual(["README.md", ...REFERENCE_PAGES.map((page) => `${page.slug}.md`)]);
		const pos = files.get("pos.md") ?? "";
		expect(pos).toContain("### POST /api/v1/redemptions/checkout");
		expect(pos).toContain("| `codes[].backupCode` |");
		expect(pos).toContain("| `data.saleId` | string (uuid) | yes |");
		expect(pos).toContain("| 409 | `IDEMPOTENCY_KEY_REUSED` |");
		expect(pos).toContain('"backupCode": "ABCD2345"');
		expect(pos).toContain("lastUpdated: 1791072000000");
		expect(files.get("access-control.md")).toContain("No captured sample: Needs a second SuperAdmin.");
		expect(files.get("README.md")).toContain("[`/api/v1/admin/roles/{id}`](./access-control.md#patch-apiv1adminrolesid)");
	});

	it("lists every media type of a file download's success response", () => {
		const document = OpenApiDocumentSchema.parse({
			paths: {
				"/api/v1/redemptions/export": {
					get: {
						operationId: "RedemptionsController_checkout",
						tags: ["Redemptions"],
						responses: {
							"200": {
								description: "The report file",
								content: { "text/csv": { schema: { type: "string", format: "binary" } }, "application/pdf": { schema: { type: "string", format: "binary" } } },
							},
						},
					},
				},
			},
		});
		const pos = renderApiReference({ document, access: ACCESS, samples: SAMPLES }).get("pos.md") ?? "";
		expect(pos).toContain("**Response 200 OK** — The report file (`text/csv` · `application/pdf`)");
	});

	it("refuses an operation whose tag has no page", () => {
		const document = OpenApiDocumentSchema.parse({ paths: { "/x": { get: { operationId: "X_get", tags: ["Unmapped"], responses: {} } } } });
		expect(() => renderApiReference({ document, access: ACCESS, samples: SAMPLES })).toThrow(/No API reference page/);
	});
});

describe("pages and samples", () => {
	it("maps each tag to exactly one page", () => {
		const tags = REFERENCE_PAGES.flatMap((page) => page.tags);
		expect(new Set(tags).size).toBe(tags.length);
		expect(pageForTags(["Claims"])?.slug).toBe("customer-rewards");
		expect(pageForTags([])).toBeUndefined();
	});

	it("tells captured samples from documented gaps", () => {
		const captured = SAMPLES.samples.RedemptionsController_checkout;
		const missing = SAMPLES.samples.RolesController_update;
		expect(captured !== undefined && isCapturedSample(captured)).toBe(true);
		expect(missing !== undefined && isCapturedSample(missing)).toBe(false);
	});
});
