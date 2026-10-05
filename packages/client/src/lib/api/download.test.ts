// @vitest-environment jsdom
import { ANALYTICS_EXPORT_CONTENT_TYPES, apiContract, EpochMsSchema } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCalls, firstFetchCall, headersOf, inputUrl, jsonResponse, type FetchImpl } from "../test-utils";
import { createApiRequestContext, type OnRefresh } from "./api-request";
import { apiDownloads, ApiDownloadError, defineDownload, fetchDownload, fileNameFromContentDisposition, saveDownloadedFile } from "./download";

const BASE_URL = "http://api.test";
const ORG_SLUG = "jonker-street-kitchen";
const FROM = EpochMsSchema.parse(1788192000000);
const TO = EpochMsSchema.parse(1790784000000);
const FILE_NAME = "analytics_jonker-street-kitchen_2026-09-01_2026-09-30_day.csv";

function fileResponse(body: string, headers: Record<string, string> = {}): Response {
	return new Response(body, {
		status: 200,
		headers: { "content-type": ANALYTICS_EXPORT_CONTENT_TYPES.csv, "content-disposition": `attachment; filename="${FILE_NAME}"; filename*=UTF-8''${FILE_NAME}`, ...headers },
	});
}

function errorResponse(status: number, code: string, details: Record<string, number> = {}, headers: Record<string, string> = {}): Response {
	const response = jsonResponse(status, { success: false, error: { code, message: `failed: ${code}`, details }, meta: { correlationId: "corr-1", timestamp: 1 } });
	for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
	return response;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("fileNameFromContentDisposition", () => {
	it("prefers the RFC 5987 filename*, then the quoted, then the bare filename", () => {
		expect(fileNameFromContentDisposition(`attachment; filename="plain.csv"; filename*=UTF-8''caf%C3%A9.csv`)).toBe("café.csv");
		expect(fileNameFromContentDisposition('attachment; filename="report.xlsx"')).toBe("report.xlsx");
		expect(fileNameFromContentDisposition("attachment; filename=report.pdf")).toBe("report.pdf");
		expect(fileNameFromContentDisposition("attachment")).toBeNull();
		expect(fileNameFromContentDisposition(null)).toBeNull();
	});
});

describe("apiDownloads", () => {
	it("derives each download from its shared file contract", () => {
		expect(apiDownloads.organizations.analyticsExport).toEqual(defineDownload(apiContract.organizations.analyticsExport));
		expect(apiDownloads.organizations.analyticsExport.contentTypes).toEqual(Object.values(ANALYTICS_EXPORT_CONTENT_TYPES));
		expect(apiDownloads.rewardsAdmin.analyticsExport.path).toBe("/admin/analytics/export");
	});
});

describe("fetchDownload", () => {
	const context = createApiRequestContext(BASE_URL, "merchant");

	it("serializes the input onto the export URL, sends the session, and resolves the Blob with the server's file name", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(fileResponse("\uFEFFSales,1\r\n"));
		vi.stubGlobal("fetch", fetchMock);

		const file = await fetchDownload(context, apiDownloads.organizations.analyticsExport, { orgSlug: ORG_SLUG, from: FROM, to: TO, format: "csv" });

		const { input, init } = firstFetchCall(fetchMock);
		expect(inputUrl(input)).toBe(`${BASE_URL}/api/v1/orgs/${ORG_SLUG}/analytics/export?from=${String(FROM)}&to=${String(TO)}&format=csv`);
		expect(init.credentials).toBe("include");
		expect(headersOf(init)["X-Client-Type"] ?? headersOf(init)["x-client-type"]).toBe("merchant");
		expect(file.fileName).toBe(FILE_NAME);
		expect(file.contentType).toBe(ANALYTICS_EXPORT_CONTENT_TYPES.csv);
		// The bytes arrive untouched — UTF-8 BOM included (Blob#text() would strip it).
		expect([...new Uint8Array(await file.blob.arrayBuffer())]).toEqual([...new TextEncoder().encode("\uFEFFSales,1\r\n")]);
	});

	it("validates the input with the shared schema before any request (from/to required)", async () => {
		const fetchMock = vi.fn<FetchImpl>();
		vi.stubGlobal("fetch", fetchMock);

		await expect(fetchDownload(context, apiDownloads.rewardsAdmin.analyticsExport, { from: TO, to: FROM, format: "pdf" })).rejects.toThrow();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("turns an error envelope into a typed ApiDownloadError with the code and Retry-After", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(errorResponse(429, "ANALYTICS_EXPORT_RATE_LIMITED", { retryAfterSeconds: 120 }, { "retry-after": "120" })));

		const failure = fetchDownload(context, apiDownloads.rewardsAdmin.analyticsExport, { from: FROM, to: TO, format: "xlsx" });

		await expect(failure).rejects.toBeInstanceOf(ApiDownloadError);
		await expect(failure).rejects.toMatchObject({ code: "ANALYTICS_EXPORT_RATE_LIMITED", statusCode: 429, retryAfterSeconds: 120, correlationId: "corr-1" });
	});

	it("refuses a 200 that is not one of the contract's media types (never saves an HTML error page as a report)", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } })));

		await expect(fetchDownload(context, apiDownloads.rewardsAdmin.analyticsExport, { from: FROM, to: TO, format: "csv" })).rejects.toMatchObject({
			code: "UNEXPECTED_CONTENT_TYPE",
		});
	});

	it("refreshes the session once on a 401 and retries", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValueOnce(errorResponse(401, "TOKEN_EXPIRED")).mockResolvedValueOnce(fileResponse("ok"));
		vi.stubGlobal("fetch", fetchMock);
		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue("ok");
		const onUnauthorized = vi.fn<() => void>();

		const file = await fetchDownload(createApiRequestContext(BASE_URL, "merchant", onUnauthorized, onRefresh), apiDownloads.organizations.analyticsExport, {
			orgSlug: ORG_SLUG,
			from: FROM,
			to: TO,
			format: "csv",
		});

		expect(onRefresh).toHaveBeenCalledTimes(1);
		expect(fetchCalls(fetchMock)).toHaveLength(2);
		expect(onUnauthorized).not.toHaveBeenCalled();
		expect(file.fileName).toBe(FILE_NAME);
	});

	it("reports a network failure as NETWORK_ERROR", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockRejectedValue(new TypeError("Failed to fetch")));

		await expect(fetchDownload(context, apiDownloads.rewardsAdmin.analyticsExport, { from: FROM, to: TO, format: "csv" })).rejects.toMatchObject({
			code: "NETWORK_ERROR",
			statusCode: 0,
		});
	});
});

describe("saveDownloadedFile", () => {
	it("clicks a temporary <a download> with the file name, then releases the object URL", () => {
		vi.useFakeTimers();
		const createObjectURL = vi.fn<(blob: Blob) => string>().mockReturnValue("blob:report");
		const revokeObjectURL = vi.fn<(url: string) => void>();
		const clicked: string[] = [];
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement): void {
			clicked.push(`${this.download}@${this.href}`);
		});

		saveDownloadedFile({ blob: new Blob(["x"]), fileName: FILE_NAME, contentType: ANALYTICS_EXPORT_CONTENT_TYPES.csv }, document, { createObjectURL, revokeObjectURL });

		expect(clicked).toEqual([`${FILE_NAME}@blob:report`]);
		expect(document.querySelectorAll("a[download]")).toHaveLength(0);
		expect(revokeObjectURL).not.toHaveBeenCalled();
		vi.runAllTimers();
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
		click.mockRestore();
	});
});
