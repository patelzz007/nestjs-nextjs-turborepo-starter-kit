// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { GANTT_EXAMPLES } from "@/components/component-gallery/examples/gantt";
import { Gantt2Example } from "@/components/component-gallery/examples/gantt/gantt-2";

describeGalleryExamples("Gantt", GANTT_EXAMPLES);

describe("Gantt example interactions", (): void => {
	installGalleryExampleShims();

	it("steps the month timeline to the next period", (): void => {
		render(<Gantt2Example />, { wrapper: UiKitTestProviders });
		// Every example pins its clock to 17 June 2026.
		expect(screen.getByText("June 2026")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Next" }));

		expect(screen.getByText("July 2026")).toBeTruthy();
		expect(screen.queryByText("June 2026")).toBeNull();
	});
});
