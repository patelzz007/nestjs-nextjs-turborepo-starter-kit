import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { create } from "fontkit";
import { Pool } from "pg";
import readXlsxFile from "read-excel-file/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { ANALYTICS_EXPORT_CONTENT_TYPES, ANALYTICS_EXPORT_RATE_LIMIT, API_VERSION_PREFIX, ApiErrorResponseSchema, JsonValueSchema } from "@workspace/shared";

import { ORGANIZATION_SEED_IDS, ORGANIZATION_SEED_SLUGS } from "../prisma/seed/organizations";
import { sha256Hex } from "../src/common/crypto/sha256";
import { REPORT_FONT_FAMILIES } from "../src/modules/rewards/analytics/report/fonts/report-fonts";
import { createE2eApp, login, markSeedUserEmailVerified, type InjectResponse, type LoginResult } from "./e2e-helpers";
import { pdfTextRuns } from "./support/report-files";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const KL_OFFSET_MS = 8 * HOUR_MS;
const klMidnight = (year: number, monthIndex: number, day: number): number => Date.UTC(year, monthIndex, day) - KL_OFFSET_MS;
const TOKEN_BYTES = 32;
/** A year of daily rows with every font family embedded (subset) stays well under this. */
const MAX_YEAR_PDF_BYTES = 1_000_000;

/** A text as it reads back from a PDF: glyph by glyph, in the visual order the shaper placed them. */
function glyphOrder(familyKey: string, value: string): string {
	const family = REPORT_FONT_FAMILIES.find((candidate) => candidate.key === familyKey);
	const font = create(readFileSync(family?.files.regular.url ?? ""));
	if ("fonts" in font) throw new Error("expected a single font");
	return font
		.layout(value)
		.glyphs.map((glyph) => String.fromCodePoint(...glyph.codePoints))
		.join("");
}

/** A quiet stretch of 2019 (before any seeded history) holding this file's own rows. */
const FROM = klMidnight(2019, 5, 1);
const TO = klMidnight(2019, 5, 4);
const RANGE = `from=${String(FROM)}&to=${String(TO)}&interval=day`;
const KATIL = ORGANIZATION_SEED_IDS.mlkLocationKatil;
const BERUANG = ORGANIZATION_SEED_IDS.mlkLocationBeruang;
/** A reward title a spreadsheet would execute as a formula if the CSV did not neutralise it. */
const HOSTILE_TITLE = '=HYPERLINK("http://evil.example","win")';

const AuditRowSchema = z.object({
	method: z.string(),
	endpoint: z.string(),
	outcome: z.string(),
	response_status: z.number(),
	actor_user_id: z.string().nullable(),
	ip_address: z.string().nullable(),
	user_agent: z.string().nullable(),
	request_params: JsonValueSchema.nullable(),
	response_body: JsonValueSchema.nullable(),
});

const ExportSummarySchema = z.object({
	export: z.object({
		report: z.enum(["merchant", "platform"]),
		subject: z.string(),
		format: z.string(),
		fileName: z.string(),
		from: z.number(),
		to: z.number(),
		timeZone: z.string(),
		interval: z.string(),
		rowCounts: z.record(z.string(), z.number()),
	}),
});

describe("Analytics exports (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	let cashier: LoginResult;
	let superAdmin: LoginResult;
	let alice: LoginResult;
	let ownerId: string;
	const rewardId = randomUUID();
	const claimId = randomUUID();
	const saleIds: string[] = [];

	function merchantExport(session: LoginResult | null, query: string, slug: string = ORGANIZATION_SEED_SLUGS.mlk): Promise<InjectResponse> {
		return app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/orgs/${slug}/analytics/export?${query}`,
			headers:
				session === null
					? { "user-agent": "e2e-export" }
					: { cookie: `merchantAccessToken=${session.accessToken}; merchantRefreshToken=${session.refreshToken}`, "x-client-type": "merchant", "user-agent": "e2e-export" },
		});
	}

	function webGet(session: LoginResult | null, url: string): Promise<InjectResponse> {
		return app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}${url}`,
			headers: session === null ? {} : { cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}` },
		});
	}

	function errorCode(response: InjectResponse): string {
		return ApiErrorResponseSchema.parse(response.json()).error.code;
	}

	async function auditRowsOf(response: InjectResponse): Promise<z.output<typeof AuditRowSchema>[]> {
		const correlationId = z.string().parse(response.headers["x-correlation-id"]);
		const result = await pool.query(
			`SELECT method, endpoint, outcome::text AS outcome, response_status, actor_user_id, ip_address, user_agent, request_params, response_body
			 FROM public.audit_logs WHERE correlation_id = $1`,
			[correlationId],
		);
		return z.array(AuditRowSchema).parse(result.rows);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		await markSeedUserEmailVerified(pool, "alice.johnson@example.com");
		const users = await pool.query<{ id: string; email: string }>("SELECT id, email FROM public.users WHERE email = ANY($1::text[])", [
			["alice.johnson@example.com", "jonker.owner@melaka-rewards.demo"],
		]);
		const aliceId = z.string().parse(users.rows.find((row) => row.email === "alice.johnson@example.com")?.id);
		ownerId = z.string().parse(users.rows.find((row) => row.email === "jonker.owner@melaka-rewards.demo")?.id);

		await pool.query(
			`INSERT INTO public.rewards (id, organization_id, title, description, reward_type, reward_value, category, placeholder_image_key, quantity_total, quantity_remaining, expiry_date, status, referrals_enabled, start_date)
			 VALUES ($1, $2, $3, 'Created by analytics-export.e2e-spec.ts', 'DISCOUNT', 5, 'restaurant', 'category-restaurant', 10, 9, $4, 'PUBLISHED', false, $5)`,
			[rewardId, ORGANIZATION_SEED_IDS.mlkOrganization, HOSTILE_TITLE, TO + DAY_MS, FROM - DAY_MS],
		);
		await pool.query(
			`INSERT INTO public.reward_claims (id, user_id, reward_id, redemption_token_hash, backup_code_hash, status, claimed_at, claim_expires_at)
			 VALUES ($1, $2, $3, $4, $5, 'EXPIRED', $6, $7)`,
			[claimId, aliceId, rewardId, sha256Hex(randomBytes(TOKEN_BYTES).toString("base64url")), sha256Hex(randomUUID()), FROM + HOUR_MS, FROM + HOUR_MS + DAY_MS],
		);
		for (const [locationId, billTotalMinor] of [
			[KATIL, 12_345],
			[BERUANG, 6_789],
		] satisfies [string, number][]) {
			const saleId = randomUUID();
			saleIds.push(saleId);
			await pool.query(
				`INSERT INTO public.reward_sales (id, organization_id, location_id, user_id, terminal_id, bill_total_minor, currency, idempotency_key, request_hash, paid_at)
				 VALUES ($1, $2, $3, $4, 'E2E-EXPORT-TILL', $5, 'MYR', $6, $7, $8)`,
				[saleId, ORGANIZATION_SEED_IDS.mlkOrganization, locationId, aliceId, billTotalMinor, randomUUID(), saleId, FROM + 10 * HOUR_MS],
			);
		}

		owner = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123", "merchant");
		cashier = await login(app, "jonker.cashier@melaka-rewards.demo", "JonkerCashier@123", "merchant");
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");
		alice = await login(app, "alice.johnson@example.com", "Alice@123");
	});

	afterAll(async () => {
		await pool.query("DELETE FROM public.reward_sales WHERE id = ANY($1::text[])", [saleIds]);
		await pool.query("DELETE FROM public.reward_claims WHERE id = $1", [claimId]);
		await pool.query("DELETE FROM public.rewards WHERE id = $1", [rewardId]);
		await pool.end();
		await app.close();
	});

	describe("merchant CSV", () => {
		it("downloads an RFC 4180 CSV with a safe deterministic name, never cached, and neutralises formulas", async () => {
			const response = await merchantExport(owner, `${RANGE}&format=csv`);

			expect(response.statusCode, response.body).toBe(200);
			expect(response.headers["content-type"]).toBe(ANALYTICS_EXPORT_CONTENT_TYPES.csv);
			expect(response.headers["content-disposition"]).toBe(
				`attachment; filename="analytics_${ORGANIZATION_SEED_SLUGS.mlk}_2019-06-01_2019-06-03_day.csv"; filename*=UTF-8''analytics_${ORGANIZATION_SEED_SLUGS.mlk}_2019-06-01_2019-06-03_day.csv`,
			);
			expect(response.headers["cache-control"]).toContain("no-store");
			expect(response.headers["x-content-type-options"]).toBe("nosniff");
			const csv = response.rawPayload.toString("utf8");
			expect(csv.startsWith("﻿")).toBe(true);
			expect(csv).toContain("Sales (MYR),191.34,0.00,191.34,\r\n");
			expect(csv).toContain("Jonker Street Kitchen — Bukit Katil,Melaka,123.45,1,123.45,0\r\n");
			expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""win"")",1,0,0.0\r\n`);
		});

		it("writes one complete audit row: who, which report, range, format and row counts", async () => {
			const response = await merchantExport(owner, `${RANGE}&format=csv`);
			expect(response.statusCode).toBe(200);

			const rows = await auditRowsOf(response);
			expect(rows).toHaveLength(1);
			const [row] = rows;
			expect(row).toMatchObject({
				method: "GET",
				endpoint: "/api/v1/orgs/:orgSlug/analytics/export",
				outcome: "SUCCEEDED",
				response_status: 200,
				actor_user_id: ownerId,
				user_agent: "e2e-export",
			});
			expect(row?.ip_address).not.toBeNull();
			const summary = ExportSummarySchema.parse(row?.response_body).export;
			expect(summary).toMatchObject({
				report: "merchant",
				subject: ORGANIZATION_SEED_SLUGS.mlk,
				format: "csv",
				from: FROM,
				to: TO,
				timeZone: "Asia/Kuala_Lumpur",
				interval: "day",
			});
			expect(summary.rowCounts).toMatchObject({ series: 3, redemptionMethods: 2 });
			expect(JSON.stringify(row?.request_params)).toContain("csv");
		});

		it("gives a store-limited cashier only their store's rows", async () => {
			const response = await merchantExport(cashier, `${RANGE}&format=csv`);

			expect(response.statusCode, response.body).toBe(200);
			const csv = response.rawPayload.toString("utf8");
			expect(csv).toContain("Bukit Beruang");
			expect(csv).not.toContain("Bukit Katil");
			expect(csv).toContain("Sales (MYR),67.89,");
			expect((await merchantExport(cashier, `${RANGE}&format=csv&locationId=${KATIL}`)).statusCode).toBe(403);
		});
	});

	describe("merchant XLSX and PDF", () => {
		it("downloads an XLSX that parses back into typed sheets", async () => {
			const response = await merchantExport(owner, `${RANGE}&format=xlsx`);

			expect(response.statusCode, response.body).toBe(200);
			expect(response.headers["content-type"]).toBe(ANALYTICS_EXPORT_CONTENT_TYPES.xlsx);
			expect(response.headers["content-disposition"]).toContain(`analytics_${ORGANIZATION_SEED_SLUGS.mlk}_2019-06-01_2019-06-03_day.xlsx`);
			const sheets = await readXlsxFile(response.rawPayload);
			expect(sheets.map((sheet) => sheet.sheet)).toEqual(["Summary", "Activity over time", "Sales by store", "Rewards", "Redemptions by method"]);
			const summary = sheets.at(0)?.data ?? [];
			expect(summary.at(1)).toEqual(["Sales (MYR)", 191.34, 0, 191.34, null]);
			const series = sheets.at(1)?.data ?? [];
			expect(series.at(1)?.at(0)).toEqual(new Date(Date.UTC(2019, 5, 1)));
			expect(series.at(1)?.at(2)).toBe(191.34);
		});

		it("downloads a valid PDF with the report's title, store and range", async () => {
			const response = await merchantExport(owner, `${RANGE}&format=pdf`);

			expect(response.statusCode, response.body).toBe(200);
			expect(response.headers["content-type"]).toBe(ANALYTICS_EXPORT_CONTENT_TYPES.pdf);
			const pdf = response.rawPayload;
			expect(pdf.subarray(0, "%PDF-".length).toString("latin1")).toBe("%PDF-");
			expect(pdf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
			const text = pdfTextRuns(pdf).join("\n");
			expect(text).toContain("Analytics report");
			expect(text).toContain("Jonker Street Kitchen");
			expect(text).toContain("2019-06-01 to 2019-06-03 (Asia/Kuala_Lumpur)");
			expect(text).toContain("Sales by store");
		});
	});

	describe("multilingual names", () => {
		it("draws the seeded Tamil, Hindi and Chinese reward titles in the PDF, shaped and without replacement characters", async () => {
			const to = Date.now();
			const response = await merchantExport(owner, `from=${String(to - 365 * DAY_MS)}&to=${String(to)}&format=pdf`);

			expect(response.statusCode, response.body).toBe(200);
			// Marks positioned on their base (e.g. the Devanagari e-sign) are separate text operators; read the runs back to back.
			const text = pdfTextRuns(response.rawPayload).join("");
			expect(text).toContain(glyphOrder("tamil", "குடும்ப இரவு உணவுடன் இலவச இனிப்பு"));
			expect(text).toContain(glyphOrder("devanagari", "सप्ताहांत ब्रंच के साथ मुफ़्त पेय"));
			expect(text).not.toContain("\uFFFD");
			expect(text).not.toMatch(/\?{2,}/);
			// A year of daily rows across four embedded font subsets still downloads quickly.
			expect(response.rawPayload.length).toBeLessThan(MAX_YEAR_PDF_BYTES);
		});

		it("keeps the Chinese reward title intact in the CSV and the XLSX", async () => {
			const to = Date.now();
			const range = `from=${String(to - 365 * DAY_MS)}&to=${String(to)}`;
			const klCashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123", "merchant");
			const csv = await merchantExport(klCashier, `${range}&format=csv`, ORGANIZATION_SEED_SLUGS.kl);
			expect(csv.statusCode, csv.body).toBe(200);
			expect(csv.rawPayload.toString("utf8")).toContain("糕点配咖啡 — 八折优惠");
			const xlsx = await merchantExport(owner, `${range}&format=xlsx`);
			const rewards = (await readXlsxFile(xlsx.rawPayload)).find((sheet) => sheet.sheet === "Rewards")?.data.map((row) => row[0]);
			expect(rewards).toEqual(expect.arrayContaining(["குடும்ப இரவு உணவுடன் இலவச இனிப்பு", "सप्ताहांत ब्रंच के साथ मुफ़्त पेय"]));
		});
	});

	describe("validation and authorization", () => {
		it("requires from, to and a known format; refuses a range over the limit with a 400", async () => {
			// As the cashier: every request counts against the caller's export budget, and the owner's is used elsewhere.
			expect((await merchantExport(cashier, "format=csv")).statusCode).toBe(400);
			expect((await merchantExport(cashier, `${RANGE}&format=docx`)).statusCode).toBe(400);
			const tooLong = await merchantExport(cashier, `from=${String(TO - 400 * DAY_MS)}&to=${String(TO)}&format=csv`);
			expect(tooLong.statusCode).toBe(400);
			expect(errorCode(tooLong)).toBe("VALIDATION_ERROR");
		});

		it("refuses an anonymous caller (401), a non-member (404 — another organization is not disclosed) and a customer on the admin export (403)", async () => {
			expect((await merchantExport(null, `${RANGE}&format=csv`)).statusCode).toBe(401);
			expect((await merchantExport(owner, `${RANGE}&format=csv`, ORGANIZATION_SEED_SLUGS.kl)).statusCode).toBe(404);
			expect((await webGet(alice, `/admin/analytics/export?${RANGE}&format=csv`)).statusCode).toBe(403);
			expect((await webGet(null, `/admin/analytics/export?${RANGE}&format=csv`)).statusCode).toBe(401);
		});
	});

	describe("admin", () => {
		it("downloads the platform report in every format", async () => {
			for (const format of ["csv", "xlsx", "pdf"] satisfies ("csv" | "xlsx" | "pdf")[]) {
				const response = await webGet(superAdmin, `/admin/analytics/export?from=${String(Date.UTC(2019, 5, 1))}&to=${String(Date.UTC(2019, 5, 4))}&format=${format}`);
				expect(response.statusCode, response.body).toBe(200);
				expect(response.headers["content-type"]).toBe(ANALYTICS_EXPORT_CONTENT_TYPES[format]);
				expect(response.headers["content-disposition"]).toContain(`filename="analytics_platform_2019-06-01_2019-06-03_day.${format}"`);
			}
		});
	});

	describe("rate limit", () => {
		it(`lets one user start ${String(ANALYTICS_EXPORT_RATE_LIMIT)} exports per window, then answers 429 with Retry-After (nothing exported; the refusal itself is audited)`, async () => {
			const klOwner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
			const range = `from=${String(FROM)}&to=${String(FROM + DAY_MS)}&format=csv`;
			for (let attempt = 0; attempt < ANALYTICS_EXPORT_RATE_LIMIT; attempt += 1) {
				expect((await merchantExport(klOwner, range, ORGANIZATION_SEED_SLUGS.kl)).statusCode).toBe(200);
			}

			const refused = await merchantExport(klOwner, range, ORGANIZATION_SEED_SLUGS.kl);
			expect(refused.statusCode).toBe(429);
			expect(errorCode(refused)).toBe("ANALYTICS_EXPORT_RATE_LIMITED");
			expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
			// Every request is audited: the refusal is one FAILED 429 row — no export summary, nothing released.
			const refusalRows = await auditRowsOf(refused);
			expect(refusalRows).toHaveLength(1);
			expect(refusalRows[0]).toMatchObject({ method: "GET", outcome: "FAILED", response_status: 429 });

			// Another user's budget is untouched.
			expect((await merchantExport(owner, range)).statusCode).toBe(200);
		});
	});
});
