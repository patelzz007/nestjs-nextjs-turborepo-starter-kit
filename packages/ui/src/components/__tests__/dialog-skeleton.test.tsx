// @vitest-environment node
import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { DialogSkeleton } from "../dialog-skeleton";

function serverRender(element: React.JSX.Element): string {
	return renderToString(<UiKitTestProviders>{element}</UiKitTestProviders>);
}

describe("DialogSkeleton", () => {
	it("server-renders in place (no portal): a status region, the scrim and the panel", () => {
		const html = serverRender(<DialogSkeleton />);
		expect(html).toContain('role="status"');
		expect(html).toContain('data-slot="dialog-skeleton"');
		expect(html).toContain("bg-scrim/10");
		expect(html).toContain("sm:max-w-md");
		expect(html).toContain("h-24");
	});

	it("takes the real dialog's width and body size", () => {
		const html = serverRender(<DialogSkeleton width="4xl" body="document" />);
		expect(html).toContain("sm:max-w-4xl");
		expect(html).toContain("h-[min(70vh,720px)]");
		expect(html).not.toContain("sm:max-w-md");
	});

	it("announces a per-usage loading label", () => {
		expect(serverRender(<DialogSkeleton labels={{ loading: "Loading the cropper…" }} />)).toContain("Loading the cropper…");
	});
});
