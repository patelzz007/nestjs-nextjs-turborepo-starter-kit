// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiContract, type AdminAnalyticsExportQuery, type AnalyticsExportFormat, type EpochMs } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiDownloadError, defineDownload, type DownloadDef, type DownloadedFile } from "../api/download";
import { AnalyticsExportMenu, describeExportFailure, formatRetryWait } from "./analytics-export-menu";

const mocks = vi.hoisted(() => ({
	download: vi.fn<(def: DownloadDef<AdminAnalyticsExportQuery>, input: AdminAnalyticsExportQuery) => Promise<DownloadedFile>>(),
}));

vi.mock("../auth", () => ({
	useAuth: (): { readonly api: { readonly download: typeof mocks.download } } => ({ api: { download: mocks.download } }),
}));

const DEFINITION: DownloadDef<AdminAnalyticsExportQuery> = defineDownload(apiContract.rewardsAdmin.analyticsExport);
const FROM: EpochMs = apiContract.rewardsAdmin.analyticsExport.input.parse({ from: Date.UTC(2026, 8, 1), to: Date.UTC(2026, 9, 1), format: "csv" }).from;
const TO: EpochMs = apiContract.rewardsAdmin.analyticsExport.input.parse({ from: Date.UTC(2026, 8, 1), to: Date.UTC(2026, 9, 1), format: "csv" }).to;

function inputFor(format: AnalyticsExportFormat): AdminAnalyticsExportQuery {
	return { from: FROM, to: TO, interval: "day", format };
}

const FILE: DownloadedFile = { blob: new Blob(["a,b"]), fileName: "analytics_platform_2026-09-01_2026-09-30_day.csv", contentType: "text/csv" };

async function chooseFormat(label: string): Promise<void> {
	fireEvent.click(screen.getByRole("button", { name: "Export" }));
	fireEvent.click(await screen.findByRole("menuitem", { name: label }));
}

let saveFile: ReturnType<typeof vi.fn<(file: DownloadedFile) => void>>;

beforeEach((): void => {
	saveFile = vi.fn<(file: DownloadedFile) => void>();
	vi.spyOn(toastMessage, "success").mockImplementation(() => "toast");
	vi.spyOn(toastMessage, "error").mockImplementation(() => "toast");
});

afterEach((): void => {
	cleanup();
	vi.resetAllMocks();
	vi.restoreAllMocks();
});

describe("formatRetryWait", () => {
	it("speaks seconds under a minute and whole minutes above", () => {
		expect(formatRetryWait(1)).toBe("1 second");
		expect(formatRetryWait(45)).toBe("45 seconds");
		expect(formatRetryWait(60)).toBe("1 minute");
		expect(formatRetryWait(61)).toBe("2 minutes");
	});
});

describe("describeExportFailure", () => {
	it("tells a rate-limited person how long to wait", () => {
		const failure = describeExportFailure(new ApiDownloadError({ code: "ANALYTICS_EXPORT_RATE_LIMITED", statusCode: 429, message: "Too many", retryAfterSeconds: 120 }));

		expect(failure).toEqual({ title: "Export limit reached", description: "You can start 10 exports every 10 minutes. Try again in 2 minutes." });
	});

	it("suggests a shorter range or coarser interval after a timeout", () => {
		expect(describeExportFailure(new ApiDownloadError({ code: "ANALYTICS_QUERY_TIMEOUT", statusCode: 503, message: "Timeout" }))?.description).toBe(
			"Choose a shorter date range or group by week or month, then export again.",
		);
	});

	it("shows the API's validation message", () => {
		expect(
			describeExportFailure(
				new ApiDownloadError({ code: "VALIDATION_ERROR", statusCode: 400, message: "The date range may cover at most 366 days — choose a shorter range" }),
			),
		).toEqual({ title: "Can't export this range", description: "The date range may cover at most 366 days — choose a shorter range" });
	});

	it("gives a support reference for an unexpected failure and stays silent for a cancelled one", () => {
		expect(describeExportFailure(new ApiDownloadError({ code: "INTERNAL_ERROR", statusCode: 500, message: "Server error", correlationId: "abc-123" }))?.description).toBe(
			"Server error (reference abc-123)",
		);
		expect(describeExportFailure(new ApiDownloadError({ code: "ABORTED", statusCode: 0, message: "aborted" }))).toBeNull();
	});
});

describe("AnalyticsExportMenu", () => {
	it("downloads the chosen format for the range on screen and saves it under the server's name", async () => {
		mocks.download.mockResolvedValue(FILE);
		render(<AnalyticsExportMenu definition={DEFINITION} inputFor={inputFor} saveFile={saveFile} />);

		await chooseFormat("Excel (XLSX)");

		await waitFor((): void => {
			expect(saveFile).toHaveBeenCalledWith(FILE);
		});
		expect(mocks.download).toHaveBeenCalledWith(DEFINITION, { from: FROM, to: TO, interval: "day", format: "xlsx" });
		expect(toastMessage.success).toHaveBeenCalledWith({ title: "Export ready", description: `${FILE.fileName} has been downloaded.` });
		expect(screen.getByRole("status").textContent).toBe(`Downloaded ${FILE.fileName}`);
	});

	it("is disabled and announces progress while a download runs", async () => {
		let finish: (file: DownloadedFile) => void = (): void => undefined;
		mocks.download.mockImplementation(
			() =>
				new Promise<DownloadedFile>((resolve): void => {
					finish = resolve;
				}),
		);
		render(<AnalyticsExportMenu definition={DEFINITION} inputFor={inputFor} saveFile={saveFile} />);

		await chooseFormat("PDF");

		expect(screen.getByRole("status").textContent).toBe("Preparing the PDF export…");
		expect(screen.getByRole("button", { name: "Export" }).hasAttribute("disabled")).toBe(true);

		await act(async (): Promise<void> => {
			finish(FILE);
			await Promise.resolve();
		});
		await waitFor((): void => {
			expect(screen.getByRole("button", { name: "Export" }).hasAttribute("disabled")).toBe(false);
		});
	});

	it("shows a toast with the wait when the export limit is reached, and saves nothing", async () => {
		mocks.download.mockRejectedValue(new ApiDownloadError({ code: "ANALYTICS_EXPORT_RATE_LIMITED", statusCode: 429, message: "Too many", retryAfterSeconds: 30 }));
		render(<AnalyticsExportMenu definition={DEFINITION} inputFor={inputFor} saveFile={saveFile} />);

		await chooseFormat("CSV");

		await waitFor((): void => {
			expect(toastMessage.error).toHaveBeenCalledWith({ title: "Export limit reached", description: "You can start 10 exports every 10 minutes. Try again in 30 seconds." });
		});
		expect(saveFile).not.toHaveBeenCalled();
		expect(screen.getByRole("status").textContent).toBe("The export failed");
	});

	it("reports a failure that is not an API error generically", async () => {
		mocks.download.mockRejectedValue(new Error("boom"));
		render(<AnalyticsExportMenu definition={DEFINITION} inputFor={inputFor} saveFile={saveFile} />);

		await chooseFormat("CSV");

		await waitFor((): void => {
			expect(toastMessage.error).toHaveBeenCalledWith({ title: "Export failed", description: "The report could not be exported. Try again." });
		});
	});

	it("can be disabled by the page", () => {
		render(<AnalyticsExportMenu definition={DEFINITION} inputFor={inputFor} saveFile={saveFile} disabled />);

		expect(screen.getByRole("button", { name: "Export" }).hasAttribute("disabled")).toBe(true);
	});
});
