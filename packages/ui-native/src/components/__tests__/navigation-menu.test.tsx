import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { SHEET_MOTION } from "../../lib/motion";
import { NavigationMenu } from "../navigation-menu";

beforeEach((): void => {
	jest.useFakeTimers();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("NavigationMenu", () => {
	it("goes straight for a link, and opens a group's panel of links", async () => {
		const onDocs = jest.fn();
		const onIntro = jest.fn();
		await render(
			<NavigationMenu
				items={[
					{ key: "start", label: "Getting started", columns: 2, links: [{ key: "intro", title: "Introduction", description: "What it is", onPress: onIntro }] },
					{ key: "docs", label: "Documentation", onPress: onDocs },
				]}
			/>,
		);
		await fireEvent.press(screen.getByRole("link", { name: "Documentation" }));
		expect(onDocs).toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: "Getting started" }));
		await fireEvent.press(screen.getByRole("link", { name: "Introduction, What it is" }));
		expect(onIntro).toHaveBeenCalled();
		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
		});
		expect(screen.queryByRole("link", { name: "Introduction, What it is" })).toBeNull();
	});
});
