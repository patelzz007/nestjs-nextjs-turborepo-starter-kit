// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { RichTextDocument } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BroadcastBodyEditor from "../broadcast-body-editor";

const SAVED: RichTextDocument = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello regulars" }] }] };

afterEach((): void => {
	cleanup();
});

describe("BroadcastBodyEditor", () => {
	it("opens a saved draft's body in the labelled editor, with the composer's toolbar", async () => {
		render(<BroadcastBodyEditor initialBody={SAVED} onChange={vi.fn()} placeholder="Write it" disabled={false} invalid={false} />, { wrapper: UiKitTestProviders });

		await waitFor((): void => {
			expect(screen.getByText("Hello regulars")).toBeTruthy();
		});
		expect(screen.getByRole("textbox", { name: "Message" })).toBeTruthy();
		expect(screen.getAllByRole("button").length).toBeGreaterThan(10);
	});

	it("starts empty for a new broadcast", async () => {
		render(<BroadcastBodyEditor initialBody={null} onChange={vi.fn()} placeholder="Write it" disabled={false} invalid={false} />, { wrapper: UiKitTestProviders });

		await waitFor((): void => {
			expect(screen.getByRole("textbox", { name: "Message" }).textContent).toBe("");
		});
	});
});
