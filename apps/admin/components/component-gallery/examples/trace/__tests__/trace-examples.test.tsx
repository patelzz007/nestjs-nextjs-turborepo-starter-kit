// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it, vi } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { TRACE_EXAMPLES } from "@/components/component-gallery/examples/trace";
import { Trace14Example } from "@/components/component-gallery/examples/trace/trace-14";
import { Trace17Example } from "@/components/component-gallery/examples/trace/trace-17";
import { Trace19Example } from "@/components/component-gallery/examples/trace/trace-19";
import { Trace2Example } from "@/components/component-gallery/examples/trace/trace-2";
import { Trace3Example } from "@/components/component-gallery/examples/trace/trace-3";
import { Trace5Example } from "@/components/component-gallery/examples/trace/trace-5";
import { Trace9Example } from "@/components/component-gallery/examples/trace/trace-9";
import { ROUTES } from "@/lib/routes";

/** The examples that render a CodeBlock inside the trace. */
const CODE_BLOCK_TRACE_IDS: readonly string[] = [
	"c-trace-1",
	"c-trace-2",
	"c-trace-3",
	"c-trace-4",
	"c-trace-8",
	"c-trace-9",
	"c-trace-11",
	"c-trace-12",
	"c-trace-14",
	"c-trace-17",
];

/** Longer than the demo resend in trace-14 takes. */
const RESEND_SETTLE_MS = 2000;

describeGalleryExamples("Trace", TRACE_EXAMPLES);

describe("Trace gallery example interactions", (): void => {
	installGalleryExampleShims();

	it("denying the change approval replaces the prompt with the outcome", (): void => {
		render(<Trace5Example />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Apply 3 changes to production?")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Deny" }));

		expect(screen.queryByText("Apply 3 changes to production?")).toBeNull();
		expect(screen.getByText("Apply denied. Nothing was changed.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Plan again" })).toBeTruthy();
	});

	it("explains the access decision rule by rule, with the skipped rules after the deciding one", (): void => {
		render(<Trace19Example />, { wrapper: UiKitTestProviders });

		expect(screen.getAllByText("Maria cannot open Billing settings").length).toBeGreaterThan(0);
		expect(screen.getByText("Denied: needs Billing admin or Admin, not Viewer")).toBeTruthy();
		expect(screen.getByText("Maria is a member of Northwind")).toBeTruthy();
	});

	it("lists every example that embeds a CodeBlock", (): void => {
		const ids = TRACE_EXAMPLES.map((example): string => example.id);
		expect(ids).toEqual(expect.arrayContaining([...CODE_BLOCK_TRACE_IDS]));
	});

	it("stopping the streaming run marks the live step stopped and offers a re-run", (): void => {
		render(<Trace2Example />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Working")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Stop" }));

		expect(screen.getByText("Stopped by you")).toBeTruthy();
		expect(screen.getByText("Stopped while thinking")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Run again" }));
		expect(screen.getByText("Working")).toBeTruthy();
	});

	it("links the cited dashboards to real admin pages", (): void => {
		render(<Trace3Example />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByText("Used 2 dashboards"));

		expect(screen.getByRole("link", { name: "Activation funnel, weekly" }).getAttribute("href")).toBe(ROUTES.analytics.index);
		expect(screen.getByRole("link", { name: "Email delivery health" }).getAttribute("href")).toBe(ROUTES.emails.log);
	});

	it("re-running the failed jobs restarts the pipeline from the tests", (): void => {
		render(<Trace9Example />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Tests failed, 2 of 418")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Re-run failed jobs" }));

		expect(screen.getByText("Running 418 tests")).toBeTruthy();
		expect(screen.getByText("Re-running 3 jobs")).toBeTruthy();
	});

	it("resending the webhook appends a delivered attempt", (): void => {
		vi.useFakeTimers();
		try {
			render(<Trace14Example />, { wrapper: UiKitTestProviders });

			expect(screen.getByText("3 attempts")).toBeTruthy();
			fireEvent.click(screen.getByRole("button", { name: "Resend event" }));
			expect(screen.getByText("Sending attempt 4")).toBeTruthy();

			act((): void => {
				vi.advanceTimersByTime(RESEND_SETTLE_MS);
			});
			expect(screen.getByText("Attempt 4 delivered, 200 in 188 ms")).toBeTruthy();
			expect(screen.getByText("4 attempts")).toBeTruthy();
		} finally {
			vi.useRealTimers();
		}
	});

	it("applying a review suggestion renames the finding to its fix", async (): Promise<void> => {
		render(<Trace17Example />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("2 open")).toBeTruthy();
		fireEvent.click(screen.getByText("Null user in getInvoice"));
		fireEvent.click(await screen.findByRole("button", { name: "Apply suggestion" }));

		expect(await screen.findByText("Guarded the null user")).toBeTruthy();
		expect(screen.getByText("1 open")).toBeTruthy();
	});
});
