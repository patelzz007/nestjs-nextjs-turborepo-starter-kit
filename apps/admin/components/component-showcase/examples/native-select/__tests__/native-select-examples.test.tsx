// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { NativeSelect1Example } from "@/components/component-showcase/examples/native-select/native-select-1";

describe("NativeSelect gallery interactions", (): void => {
	installJsdomUiShims();

	it("selects the picked option and keeps disabled options unavailable", (): void => {
		render(<NativeSelect1Example />, { wrapper: UiKitTestProviders });
		const select = screen.getByRole<HTMLSelectElement>("combobox");

		expect(select.value).toBe("");
		fireEvent.change(select, { target: { value: "banana" } });

		expect(select.value).toBe("banana");
		expect(screen.getByRole<HTMLOptionElement>("option", { name: "Banana" }).selected).toBe(true);
		expect(screen.getByRole<HTMLOptionElement>("option", { name: "Grapes" }).disabled).toBe(true);
	});
});
