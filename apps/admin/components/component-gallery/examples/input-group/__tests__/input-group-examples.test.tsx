// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { INPUT_GROUP_EXAMPLES } from "@/components/component-gallery/examples/input-group";
import { InputGroup17Example } from "@/components/component-gallery/examples/input-group/input-group-17";
import { InputGroup35Example } from "@/components/component-gallery/examples/input-group/input-group-35";

describeGalleryExamples("Input Group", INPUT_GROUP_EXAMPLES);

describe("Input Group gallery example interactions", (): void => {
	installGalleryExampleShims();

	it("reveals and hides the password from the addon button", (): void => {
		render(<InputGroup35Example />, { wrapper: UiKitTestProviders });
		const input = screen.getByPlaceholderText("Enter password");
		expect(input.getAttribute("type")).toBe("password");

		fireEvent.click(screen.getByRole("button", { name: "Show password" }));
		expect(input.getAttribute("type")).toBe("text");

		fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
		expect(input.getAttribute("type")).toBe("password");
	});

	it("counts the characters typed into the description", (): void => {
		render(<InputGroup17Example />, { wrapper: UiKitTestProviders });

		fireEvent.change(screen.getByPlaceholderText("Description..."), { target: { value: "Hello" } });

		expect(screen.getByText("5/140 characters")).toBeTruthy();
	});
});
