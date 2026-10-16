// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { ITEM_EXAMPLES } from "@/components/component-gallery/examples/item";
import { Item4Example } from "@/components/component-gallery/examples/item/item-4";
import { Item9Example } from "@/components/component-gallery/examples/item/item-9";
import { ROUTES } from "@/lib/routes";

describeGalleryExamples("Item", ITEM_EXAMPLES);

describe("Item gallery interactions", (): void => {
	installGalleryExampleShims();

	it("links each navigation row to a real admin route", (): void => {
		render(<Item4Example />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("link", { name: /Profile/ }).getAttribute("href")).toBe(ROUTES.account.profile);
		expect(screen.getByRole("link", { name: /Security/ }).getAttribute("href")).toBe(ROUTES.account.security);
		expect(screen.getByRole("link", { name: /Activity/ }).getAttribute("href")).toBe(ROUTES.auditLogs.list);
	});

	it("opens a member's actions menu from its row", async (): Promise<void> => {
		render(<Item9Example />, { wrapper: UiKitTestProviders });
		const [firstTrigger] = screen.getAllByRole("button", { name: "Actions" });

		expect(screen.queryByRole("menuitem", { name: "Change Role" })).toBeNull();
		fireEvent.click(firstTrigger ?? document.body);

		expect((await screen.findByRole("menuitem", { name: "Change Role" })).textContent).toBe("Change Role");
		expect(screen.getByRole("menuitem", { name: "Remove" }).textContent).toBe("Remove");
	});
});
