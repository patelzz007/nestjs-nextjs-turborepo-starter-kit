import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Pagination } from "../pagination";

function germanPageLabel(page: number, pageCount: number): string {
	return `Seite ${String(page)} von ${String(pageCount)}`;
}

const PAGE_COUNT = 10;
const MIDDLE_PAGE = 4;

describe("Pagination", () => {
	it("shows the page indicator and asks for the neighbouring pages", async () => {
		const onChange = jest.fn();
		await render(<Pagination page={MIDDLE_PAGE} pageCount={PAGE_COUNT} onChange={onChange} testID="pager" />);

		expect(screen.getByText("Page 4 of 10")).toBeOnTheScreen();
		expect(screen.getByTestId("pager")).toHaveAccessibleName("Pagination");
		await fireEvent.press(screen.getByRole("button", { name: "Previous" }));
		expect(onChange).toHaveBeenLastCalledWith(MIDDLE_PAGE - 1);
		await fireEvent.press(screen.getByRole("button", { name: "Next" }));
		expect(onChange).toHaveBeenLastCalledWith(MIDDLE_PAGE + 1);
	});

	it("disables the button at either end instead of clamping", async () => {
		const onChange = jest.fn();
		await render(<Pagination page={1} pageCount={PAGE_COUNT} onChange={onChange} />);
		expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: "Previous" }));
		expect(onChange).not.toHaveBeenCalled();

		await render(<Pagination page={PAGE_COUNT} pageCount={PAGE_COUNT} onChange={onChange} />);
		expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
	});

	it("blocks both buttons while loading or disabled, and announces busy", async () => {
		await render(<Pagination page={MIDDLE_PAGE} pageCount={PAGE_COUNT} onChange={jest.fn()} loading testID="pager" />);
		expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
		expect(screen.getByTestId("pager")).toHaveProp("accessibilityState", expect.objectContaining({ busy: true }));

		await render(<Pagination page={MIDDLE_PAGE} pageCount={PAGE_COUNT} onChange={jest.fn()} disabled loading testID="pager" />);
		expect(screen.getByTestId("pager")).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
	});

	it("takes overridden copy", async () => {
		await render(
			<Pagination
				page={2}
				pageCount={3}
				onChange={jest.fn()}
				previousLabel="Zurück"
				nextLabel="Weiter"
				formatPageLabel={germanPageLabel}
				accessibilityLabel="Seiten"
				testID="pager"
			/>,
		);

		expect(screen.getByRole("button", { name: "Zurück" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Weiter" })).toBeOnTheScreen();
		expect(screen.getByText("Seite 2 von 3")).toBeOnTheScreen();
		expect(screen.getByTestId("pager")).toHaveAccessibleName("Seiten");
	});

	it("has a ghost variant and a compact size", async () => {
		await render(<Pagination page={2} pageCount={3} onChange={jest.fn()} variant="ghost" size="sm" />);

		const next = screen.getByRole("button", { name: "Next" });
		expect(next).toHaveProp("className", expect.stringContaining("bg-transparent"));
		expect(next).toHaveProp("className", expect.stringContaining("min-h-9"));
		expect(screen.getByText("Page 2 of 3")).toHaveProp("className", expect.stringContaining("text-xs"));
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Pagination ref={ref} page={1} pageCount={1} onChange={jest.fn()} className="gap-1" testID="pager" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("pager").props.className);
		expect(className).toContain("gap-1");
		expect(className).not.toContain("gap-3");
	});
});
