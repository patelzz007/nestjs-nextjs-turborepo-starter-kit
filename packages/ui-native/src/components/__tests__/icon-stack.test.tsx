import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { IconStack } from "../icon-stack";

function stack(): ReturnType<typeof screen.getByTestId> {
	return screen.getByTestId("stack", { includeHiddenElements: true });
}

describe("IconStack", () => {
	it("is decorative: hidden from screen readers", async () => {
		await render(<IconStack testID="stack" />);
		expect(screen.queryByTestId("stack")).toBeNull();
		expect(stack()).toBeTruthy();
	});

	it("prints its content on the front layer", async () => {
		await render(
			<IconStack testID="stack">
				<Text>glyph</Text>
			</IconStack>,
		);
		expect(screen.getByText("glyph", { includeHiddenElements: true })).toBeTruthy();
	});

	it.each([
		["xs", "h-12"],
		["sm", "h-16"],
		["md", "h-20"],
		["lg", "h-24"],
		["xl", "h-28"],
	] satisfies [React.ComponentProps<typeof IconStack>["size"], string][])("has a %s size (%s)", async (size, height) => {
		await render(<IconStack size={size} tone="primary" testID="stack" />);
		expect(String(stack().props.className).split(" ")).toContain(height);
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<IconStack ref={ref} className="h-9" testID="stack" />);
		expect(ref.current).not.toBeNull();
		expect(String(stack().props.className).split(" ")).toContain("h-9");
		expect(String(stack().props.className).split(" ")).not.toContain("h-20");
	});
});
