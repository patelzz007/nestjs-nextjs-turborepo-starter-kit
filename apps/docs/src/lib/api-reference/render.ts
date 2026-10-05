import type { EndpointAccess } from "./endpoint-access";
import { isCapturedSample, listEndpoints, type ApiSamplesFile, type CapturedSample, type Endpoint, type JsonSchema, type OpenApiDocument, type Parameter } from "./openapi";
import { pageForTags, REFERENCE_PAGES, type ReferencePage } from "./pages";
import { resolveSchema, schemaRows, typeLabel, type FieldRow, type SchemaRegistry } from "./schema-table";

/**
 * Renders the API reference (`docs/technical/api-reference/*.md`) from three
 * generated inputs: the OpenAPI export, the controller decorators and the
 * captured seed samples. Pure: inputs in, `{ fileName → markdown }` out. The
 * reference test (`api-reference.artifact.test.ts`) compares the result with
 * the committed files, so a changed route, schema, guard or sample that is not
 * re-rendered fails `pnpm test`.
 */

export interface ApiReferenceInputs {
	readonly document: OpenApiDocument;
	readonly access: ReadonlyMap<string, EndpointAccess>;
	readonly samples: ApiSamplesFile;
}

const COVER_IMAGE = "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop";
const GENERATED_NOTICE =
	"<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->";
const HTTP_STATUS_TEXT: Readonly<Record<string, string>> = {
	"200": "OK",
	"201": "Created",
	"202": "Accepted",
	"204": "No Content",
	"400": "Bad Request",
	"401": "Unauthorized",
	"403": "Forbidden",
	"404": "Not Found",
	"409": "Conflict",
	"410": "Gone",
	"422": "Unprocessable Entity",
	"429": "Too Many Requests",
	"503": "Service Unavailable",
};
const SUCCESS_STATUS = /^2\d\d$/;
const JSON_MEDIA_TYPE = "application/json";
/** Envelope keys every JSON success response carries (documented once, on the index page). */
const ENVELOPE_META_KEYS: ReadonlySet<string> = new Set(["correlationId", "timestamp"]);
/** `409 IDEMPOTENCY_KEY_REUSED`-style status + code pairs quoted in operation descriptions. */
const STATUS_CODE_IN_TEXT = /\b([45]\d\d) ([A-Z][A-Z0-9_]{2,})\b/g;

/** Same anchor rules as GitHub and the docs link checker (`scripts/check-links.mjs`). */
export function headingAnchor(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, "")
		.replace(/ /g, "-")
		.replace(/^-+|-+$/g, "");
}

export function endpointHeading(endpoint: Endpoint): string {
	return `${endpoint.method.toUpperCase()} ${endpoint.path}`;
}

/** Escapes text for a Markdown table cell. */
function cell(text: string): string {
	return text.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function code(text: string): string {
	return `\`${text.replace(/`/g, "'")}\``;
}

function frontmatter(title: string, description: string, lastUpdated: number, order: number): string {
	return [
		"---",
		`title: ${JSON.stringify(title)}`,
		`description: ${JSON.stringify(description)}`,
		`order: ${String(order)}`,
		'author: "Generated from the OpenAPI export"',
		`lastUpdated: ${String(lastUpdated)}`,
		`coverImage: ${JSON.stringify(COVER_IMAGE)}`,
		'tags: ["api", "reference", "generated"]',
		"---",
		"",
		GENERATED_NOTICE,
		"",
	].join("\n");
}

function fieldTable(rows: readonly FieldRow[]): string {
	if (rows.length === 0) return "_No fields._\n";
	const lines = ["| Field | Type | Required | Notes |", "| --- | --- | --- | --- |"];
	for (const row of rows) {
		lines.push(`| ${code(row.name)} | ${cell(row.type)} | ${row.required ? "yes" : "no"} | ${cell(row.notes)} |`);
	}
	return `${lines.join("\n")}\n`;
}

function parameterTable(parameters: readonly Parameter[], registry: SchemaRegistry): string {
	const lines = ["| Name | In | Type | Required | Notes |", "| --- | --- | --- | --- | --- |"];
	for (const parameter of parameters) {
		const type = parameter.schema === undefined ? "string" : typeLabel(parameter.schema, registry);
		const notes = parameter.description ?? (parameter.schema === undefined ? "" : (resolveSchema(parameter.schema, registry).description ?? ""));
		lines.push(`| ${code(parameter.name)} | ${parameter.in} | ${cell(type)} | ${parameter.required === true ? "yes" : "no"} | ${cell(notes)} |`);
	}
	return `${lines.join("\n")}\n`;
}

/** Who may call the endpoint, as bullet points. */
export function accessLines(endpoint: Endpoint, access: EndpointAccess | undefined): readonly string[] {
	if (access === undefined) return ["Not found in the controller sources — check the controller decorators."];
	const lines: string[] = [];
	if (access.merchantApiKey) {
		lines.push("**Merchant API key** — `X-API-Key: mk_live_…` (or `Authorization: Bearer mk_live_…`). No cookie, no session.");
	} else if (access.refreshToken) {
		lines.push("**Refresh-token cookie** — sent automatically by the browser after login.");
	} else if (access.isPublic) {
		lines.push("**Public** — no session required.");
	} else {
		lines.push(
			"**Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.",
		);
	}
	if (access.superAdminOnly) lines.push("**SuperAdmin only.**");
	if (access.adminAccessOnly) lines.push("**Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).");
	for (const permission of access.permissions) lines.push(`**Permission** ${code(permission)}.`);
	for (const policy of access.policies)
		lines.push(`**Policy** ${code(policy.split(" — ")[0] ?? policy)}${policy.includes(" — ") ? ` — ${policy.split(" — ").slice(1).join(" — ")}` : ""}.`);
	if (endpoint.path.includes("/orgs/{orgSlug}") && !access.isPublic) {
		lines.push(
			"**Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).",
		);
	}
	if (access.allowsIntegrationKey) lines.push("Also accepts an **INTEGRATION-scope merchant API key**.");
	if (access.emailVerified) lines.push("Requires a **verified email address**.");
	if (access.fullSession) lines.push("Requires a **full session** (email verified and, where required, 2FA enrolled).");
	return lines;
}

function behaviourLines(access: EndpointAccess | undefined, method: string): readonly string[] {
	if (access === undefined) return [];
	const lines: string[] = [];
	for (const throttle of access.throttles) lines.push(`Rate limit: ${throttle}.`);
	if (access.idempotent) lines.push("Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.");
	if (access.rlsBypass)
		lines.push("Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).");
	if (method !== "get" && !access.skipsMutationIntent && !access.merchantApiKey && !access.isPublic) {
		lines.push("Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).");
	}
	return lines;
}

/** Status + description of each declared error response, plus codes quoted in the description. */
function errorRows(endpoint: Endpoint, access: EndpointAccess | undefined): readonly string[] {
	const rows: string[] = [];
	for (const [status, response] of Object.entries(endpoint.operation.responses)) {
		if (SUCCESS_STATUS.test(status) || status === "4XX" || status === "5XX") continue;
		rows.push(`| ${status} | — | ${cell(response.description)} |`);
	}
	for (const match of `${endpoint.operation.summary ?? ""} ${endpoint.operation.description ?? ""}`.matchAll(STATUS_CODE_IN_TEXT)) {
		rows.push(`| ${match[1] ?? ""} | ${code(match[2] ?? "")} | Stated in the endpoint description. |`);
	}
	const hasInput = endpoint.operation.parameters.length > 0 || endpoint.operation.requestBody !== undefined;
	if (hasInput) rows.push("| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |");
	const needsSession = access !== undefined && !access.isPublic;
	const needsKey = access?.merchantApiKey === true;
	if (needsSession) rows.push("| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |");
	if (needsKey) rows.push("| 401 | `MERCHANT_API_KEY_REQUIRED`, `MERCHANT_API_KEY_INVALID` | Missing, unknown or revoked API key. |");
	if (needsSession && (access.superAdminOnly || access.permissions.length > 0 || access.policies.length > 0 || access.adminAccessOnly)) {
		rows.push("| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |");
	}
	rows.push("| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |");
	return rows;
}

/** The documented success response of an operation. */
interface SuccessResponse {
	readonly status: string;
	readonly description: string;
	readonly schema: JsonSchema | undefined;
	readonly mediaType: string | undefined;
	/** Every media type the response may have (a file download lists one per format). */
	readonly mediaTypes: readonly string[];
}

function successResponse(endpoint: Endpoint): SuccessResponse | undefined {
	const entry = Object.entries(endpoint.operation.responses).find(([status]) => SUCCESS_STATUS.test(status));
	if (entry === undefined) return undefined;
	const [status, response] = entry;
	const mediaTypes = Object.keys(response.content ?? {});
	const mediaType = mediaTypes[0];
	const schema = mediaType === undefined ? undefined : response.content?.[mediaType]?.schema;
	return { status, description: response.description, schema, mediaType, mediaTypes };
}

/** Rows of the `data` part of a `{ success, data, meta }` envelope (and any list `meta` beyond the envelope's own). */
function responseRows(schema: JsonSchema, registry: SchemaRegistry): readonly FieldRow[] {
	const resolved = resolveSchema(schema, registry);
	const properties = resolved.properties;
	const data = properties?.data;
	if (properties?.success === undefined || data === undefined) {
		return schemaRows(resolved, registry);
	}
	const rows: FieldRow[] = [];
	const dataResolved = resolveSchema(data, registry);
	const dataRows = schemaRows(dataResolved, registry);
	if (dataRows.length === 0 || dataResolved.type === "array") {
		rows.push({ name: "data", type: typeLabel(dataResolved, registry), required: true, notes: dataResolved.description ?? "" });
	}
	rows.push(...dataRows.map((row) => ({ ...row, name: row.name.startsWith("[]") ? `data${row.name}` : `data.${row.name}` })));
	const meta = properties.meta;
	if (meta !== undefined) {
		for (const row of schemaRows(meta, registry)) {
			if (!ENVELOPE_META_KEYS.has(row.name)) rows.push({ ...row, name: `meta.${row.name}` });
		}
	}
	return rows;
}

function sampleRequest(sample: CapturedSample): string {
	const query = sample.request.query === undefined ? "" : `?${new URLSearchParams(sample.request.query).toString()}`;
	const lines = [`${sample.request.method} ${sample.request.path}${query}`];
	for (const [name, value] of Object.entries(sample.request.headers)) lines.push(`${name}: ${value}`);
	const body = sample.request.body;
	if (body !== undefined) {
		const isMultipart = typeof body === "object" && body !== null && !Array.isArray(body) && "multipart/form-data" in body;
		lines.push(`Content-Type: ${isMultipart ? "multipart/form-data" : JSON_MEDIA_TYPE}`, "", JSON.stringify(body, null, 2));
	}
	return lines.join("\n");
}

function renderSample(endpoint: Endpoint, inputs: ApiReferenceInputs): string {
	const sample = inputs.samples.samples[endpoint.operation.operationId];
	if (sample === undefined) {
		return "> [!WARNING]\n> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.\n";
	}
	if (!isCapturedSample(sample)) {
		return `> [!NOTE]\n> No captured sample: ${sample.notCaptured}\n`;
	}
	const statusText = HTTP_STATUS_TEXT[String(sample.response.status)] ?? "";
	const parts = [`**Example** — called as ${sample.as}${sample.note === undefined ? "." : `. ${sample.note}`}`, "", "```http", sampleRequest(sample), "```", ""];
	parts.push(`Response \`${String(sample.response.status)} ${statusText}\`${sample.response.contentType.length > 0 ? ` (${sample.response.contentType})` : ""}:`, "");
	const body = sample.response.body;
	if (typeof body === "string") {
		parts.push("```text", body, "```", "");
	} else {
		parts.push("```json", JSON.stringify(body, null, 2), "```", "");
	}
	return parts.join("\n");
}

function renderEndpoint(endpoint: Endpoint, inputs: ApiReferenceInputs): string {
	const registry: SchemaRegistry = inputs.document.components.schemas;
	const { operation } = endpoint;
	const access = inputs.access.get(operation.operationId);
	const parts: string[] = [`### ${endpointHeading(endpoint)}`, ""];
	if (operation.deprecated === true) parts.push("> [!WARNING]\n> Deprecated.", "");
	if (operation.summary !== undefined) parts.push(operation.summary, "");
	if (operation.description !== undefined) parts.push(operation.description, "");
	parts.push(...accessLines(endpoint, access).map((line) => `- ${line}`));
	parts.push(...behaviourLines(access, endpoint.method).map((line) => `- ${line}`));
	parts.push(`- Operation id ${code(operation.operationId)}${access === undefined ? "" : ` · [source](../../../${access.sourceFile})`}`, "");

	const parameters = operation.parameters.filter((parameter) => parameter.in !== "cookie");
	if (parameters.length > 0) parts.push("**Parameters**", "", parameterTable(parameters, registry));

	const requestMediaType = Object.keys(operation.requestBody?.content ?? {})[0];
	const requestSchema = requestMediaType === undefined ? undefined : operation.requestBody?.content[requestMediaType]?.schema;
	if (requestSchema !== undefined) {
		parts.push(
			`**Request body** (${code(requestMediaType ?? JSON_MEDIA_TYPE)}${operation.requestBody?.required === true ? ", required" : ""})`,
			"",
			fieldTable(schemaRows(requestSchema, registry)),
		);
	}

	const success = successResponse(endpoint);
	if (success !== undefined) {
		const label = `${success.status} ${HTTP_STATUS_TEXT[success.status] ?? ""}`.trim();
		if (success.schema !== undefined && success.mediaType === JSON_MEDIA_TYPE) {
			parts.push(`**Response ${label}** — ${success.description}`, "", fieldTable(responseRows(success.schema, registry)));
		} else {
			const mediaTypes = success.mediaTypes.map((mediaType) => code(mediaType)).join(" · ");
			parts.push(`**Response ${label}** — ${success.description}${mediaTypes.length === 0 ? "" : ` (${mediaTypes})`}`, "");
		}
	}

	parts.push("**Errors** (standard envelope, branch on `error.code`)", "", "| Status | Code | When |", "| --- | --- | --- |", ...errorRows(endpoint, access), "");
	parts.push(renderSample(endpoint, inputs));
	return parts.join("\n");
}

function endpointsByPage(inputs: ApiReferenceInputs): ReadonlyMap<ReferencePage, readonly Endpoint[]> {
	const byPage = new Map<ReferencePage, Endpoint[]>(REFERENCE_PAGES.map((page) => [page, []]));
	for (const endpoint of listEndpoints(inputs.document)) {
		const page = pageForTags(endpoint.operation.tags);
		if (page === undefined) {
			throw new Error(
				`No API reference page for tag(s) [${endpoint.operation.tags.join(", ")}] of ${endpoint.operation.operationId} — add the tag to REFERENCE_PAGES (src/lib/api-reference/pages.ts).`,
			);
		}
		byPage.get(page)?.push(endpoint);
	}
	return byPage;
}

function renderPage(page: ReferencePage, endpoints: readonly Endpoint[], inputs: ApiReferenceInputs, order: number): string {
	const parts = [frontmatter(`API reference — ${page.title}`, page.description, inputs.samples.capturedAt, order), `# API reference — ${page.title}`, ""];
	parts.push(
		page.description,
		"",
		`How these endpoints fit together: [${page.guide.label}](${page.guide.href}). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).`,
		"",
	);
	for (const tag of page.tags) {
		const tagged = endpoints.filter((endpoint) => endpoint.operation.tags[0] === tag);
		if (tagged.length === 0) continue;
		parts.push(`## ${tag}`, "");
		for (const endpoint of tagged) parts.push(renderEndpoint(endpoint, inputs));
	}
	return `${parts
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd()}\n`;
}

function renderIndex(byPage: ReadonlyMap<ReferencePage, readonly Endpoint[]>, inputs: ApiReferenceInputs): string {
	const total = [...byPage.values()].reduce((sum, endpoints) => sum + endpoints.length, 0);
	const captured = Object.values(inputs.samples.samples).filter((sample) => isCapturedSample(sample)).length;
	const parts = [
		frontmatter(
			"API reference",
			`Every endpoint of the API (${String(total)} operations), generated from the OpenAPI export with real seed-data samples.`,
			inputs.samples.capturedAt,
			1,
		),
		"# API reference",
		"",
		`Every endpoint of \`apps/api\` — ${String(total)} operations, ${String(captured)} with a sample captured from a freshly seeded API (\`${inputs.samples.capturedFrom}\`). Read [API conventions](../api/README.md) first: the response envelope, authentication, the \`X-Client-Type\` and \`X-Mutation-Intent\` headers, errors and list queries apply to every endpoint below.`,
		"",
		"> [!NOTE]",
		"> This folder is generated. Edit the controllers / zod contracts (or the capture script), then run `pnpm docs:api` — see [how the reference is generated](../api/README.md#how-the-reference-is-generated).",
		"",
		"## Pages",
		"",
		"| Page | Endpoints | Covers |",
		"| --- | --- | --- |",
	];
	for (const [page, endpoints] of byPage) {
		parts.push(`| [${page.title}](./${page.slug}.md) | ${String(endpoints.length)} | ${cell(page.description)} |`);
	}
	parts.push("", "## All endpoints", "", "| Method | Path | Summary |", "| --- | --- | --- |");
	for (const [page, endpoints] of byPage) {
		for (const endpoint of endpoints) {
			const anchor = headingAnchor(endpointHeading(endpoint));
			parts.push(`| ${endpoint.method.toUpperCase()} | [${code(endpoint.path)}](./${page.slug}.md#${anchor}) | ${cell(endpoint.operation.summary ?? "")} |`);
		}
	}
	return `${parts.join("\n")}\n`;
}

/** Every generated file: `README.md` (index) plus one page per {@link REFERENCE_PAGES} entry. */
export function renderApiReference(inputs: ApiReferenceInputs): ReadonlyMap<string, string> {
	const byPage = endpointsByPage(inputs);
	const files = new Map<string, string>([["README.md", renderIndex(byPage, inputs)]]);
	let order = 2;
	for (const [page, endpoints] of byPage) {
		files.set(`${page.slug}.md`, renderPage(page, endpoints, inputs, order));
		order += 1;
	}
	return files;
}
