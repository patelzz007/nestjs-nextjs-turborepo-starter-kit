import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Separator } from "../separator";

function classNameOf(testID: string): string {
	return String(screen.getByTestId(testID, { includeHiddenElements: true }).props.className);
}

describe("Separator", () => {
	it("is decorative: hidden from screen readers", async () => {
		await render(<Separator testID="line" />);

		expect(screen.queryByTestId("line")).toBeNull();
		expect(screen.getByTestId("line", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("runs across by default and down when vertical", async () => {
		const view = await render(<Separator testID="line" />);
		expect(classNameOf("line")).toContain("h-px w-full");

		await view.rerender(<Separator orientation="vertical" testID="line" />);
		expect(classNameOf("line")).toContain("w-px self-stretch");
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Separator ref={ref} />);
		expect(ref.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<Separator className="my-2 bg-muted-foreground" testID="line" />);
		expect(classNameOf("line")).toContain("bg-muted-foreground");
		expect(classNameOf("line")).not.toContain("bg-border");
	});
});
