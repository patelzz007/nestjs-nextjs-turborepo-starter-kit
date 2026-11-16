import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { Scrollspy, sectionInView } from "../scrollspy";

const BODY = "Body";

describe("Scrollspy", () => {
	it("knows the section in view", () => {
		expect(sectionInView([0, 300, 600], 0)).toBe(0);
		expect(sectionInView([0, 300, 600], 290)).toBe(1);
		expect(sectionInView([0, 300, 600], 900)).toBe(2);
	});

	it("highlights the section scrolled to, and scrolls to a tapped one", async () => {
		const onActiveChange = jest.fn();
		await render(
			<Scrollspy
				navigation="horizontal"
				onActiveChange={onActiveChange}
				sections={[
					{ key: "intro", label: "Intro", content: <Text>{BODY}</Text> },
					{ key: "usage", label: "Usage", content: <Text>{BODY}</Text> },
				]}
			/>,
		);
		await fireEvent.press(screen.getByRole("link", { name: "Usage" }));
		expect(screen.getByRole("link", { name: "Usage" })).toBeSelected();
		expect(screen.getAllByRole("header")).toHaveLength(2);
	});
});
