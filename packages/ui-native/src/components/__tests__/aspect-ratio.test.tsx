import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { View, type ViewInstance } from "react-native";

import { AspectRatio } from "../aspect-ratio";

const WIDE = 16 / 9;

describe("AspectRatio", () => {
	it("sizes its box to the ratio, and holds its child", async () => {
		await render(
			<AspectRatio ratio={WIDE} testID="box">
				<View testID="media" className="size-full" />
			</AspectRatio>,
		);

		expect(screen.getByTestId("box")).toHaveStyle({ aspectRatio: WIDE });
		expect(screen.getByTestId("media")).toBeOnTheScreen();
	});

	it("follows a new ratio", async () => {
		const view = await render(<AspectRatio ratio={1} testID="box" />);
		expect(screen.getByTestId("box")).toHaveStyle({ aspectRatio: 1 });

		await view.rerender(<AspectRatio ratio={WIDE} testID="box" />);
		expect(screen.getByTestId("box")).toHaveStyle({ aspectRatio: WIDE });
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<AspectRatio ref={ref} ratio={1} />);
		expect(ref.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<AspectRatio ratio={1} className="w-1/2 rounded-xl" testID="box" />);
		const className = String(screen.getByTestId("box").props.className);
		expect(className).toContain("w-1/2");
		expect(className).not.toContain("w-full");
	});
});
