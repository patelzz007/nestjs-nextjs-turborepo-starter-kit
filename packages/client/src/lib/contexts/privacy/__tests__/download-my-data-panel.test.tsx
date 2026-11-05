// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toastMessage } from "@workspace/ui/components/toast";
import { accessibilityViolations } from "@workspace/ui/testing/axe";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { z } from "zod";

import { ApiDownloadError, apiDownloads, type DownloadedFile } from "../../../api/download";
import { describeDataExportFailure, DownloadMyDataPanel, formatExportWait } from "../download-my-data-panel";

/** The real "Download my data" definition and its input, so the mock has exactly its shape. */
type DataExportDownload = typeof apiDownloads.privacy.dataExport;
type DataExportInput = z.output<DataExportDownload["inputSchema"]>;

const mocks = vi.hoisted(() => ({
	download: vi.fn<(def: DataExportDownload, input: DataExportInput) => Promise<DownloadedFile>>(),
}));

vi.mock("../../identity", () => ({
	useAuth: (): { readonly api: { readonly download: typeof mocks.download } } => ({ api: { download: mocks.download } }),
}));

const FILE: DownloadedFile = { blob: new Blob(["PK"]), fileName: "personal-data-2026-11-03.zip", contentType: "application/zip" };
const HTTP_TOO_MANY_REQUESTS = 429;
const TWENTY_THREE_HOURS_S = 23 * 3_600 - 120;

let saveFile: ReturnType<typeof vi.fn<(file: DownloadedFile) => void>>;

beforeEach((): void => {
	saveFile = vi.fn<(file: DownloadedFile) => void>();
	vi.spyOn(toastMessage, "success").mockImplementation(() => "toast");
	vi.spyOn(toastMessage, "error").mockImplementation(() => "toast");
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
	mocks.download.mockReset();
});

function renderPanel(): void {
	render(<DownloadMyDataPanel saveFile={saveFile} />, { wrapper: UiKitTestProviders });
}

describe("DownloadMyDataPanel", () => {
	it("downloads the export, saves it under the server's name, and says so", async () => {
		mocks.download.mockResolvedValue(FILE);
		renderPanel();
		fireEvent.click(screen.getByRole("button", { name: "Download my data" }));

		await waitFor((): void => {
			expect(saveFile).toHaveBeenCalledWith(FILE);
		});
		expect(mocks.download).toHaveBeenCalledWith(apiDownloads.privacy.dataExport, {});
		expect(screen.getByRole("status").textContent).toBe("Downloaded personal-data-2026-11-03.zip");
		expect(toastMessage.success).toHaveBeenCalled();
	});

	it("says how long until the next export when today's is used", async () => {
		mocks.download.mockRejectedValue(
			new ApiDownloadError({ code: "RATE_LIMITED", statusCode: HTTP_TOO_MANY_REQUESTS, message: "Too many requests", retryAfterSeconds: TWENTY_THREE_HOURS_S }),
		);
		renderPanel();
		fireEvent.click(screen.getByRole("button", { name: "Download my data" }));

		await waitFor((): void => {
			expect(toastMessage.error).toHaveBeenCalledWith({
				title: "You've already downloaded your data today",
				description: "You can download it once a day. Try again in 23 hours.",
			});
		});
		expect(saveFile).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Download my data" })).toHaveProperty("disabled", false);
	});

	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		renderPanel();
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});

describe("formatExportWait", () => {
	it("counts minutes under an hour, hours above", () => {
		expect(formatExportWait(30)).toBe("1 minute");
		expect(formatExportWait(40 * 60)).toBe("40 minutes");
		expect(formatExportWait(3_600)).toBe("1 hour");
		expect(formatExportWait(TWENTY_THREE_HOURS_S)).toBe("23 hours");
	});
});

describe("describeDataExportFailure", () => {
	it("stays quiet when cancelled, and explains each other failure", () => {
		const failure = (code: string, correlationId?: string): ApiDownloadError =>
			new ApiDownloadError({ code, statusCode: 400, message: "Something went wrong", correlationId });
		expect(describeDataExportFailure(failure("ABORTED"))).toBeNull();
		expect(describeDataExportFailure(failure("RESTRICTED_SESSION"))?.title).toBe("Finish securing your account first");
		expect(describeDataExportFailure(failure("NETWORK_ERROR"))?.description).toBe("Check your connection and try again.");
		expect(describeDataExportFailure(failure("RATE_LIMITED"))?.description).toBe("You can download it once a day. Try again tomorrow.");
		expect(describeDataExportFailure(failure("INTERNAL_ERROR", "corr-1"))?.description).toBe("Something went wrong (reference corr-1)");
	});
});
