import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { Menubar } from "../menubar";

describe("Menubar", () => {
	it("opens each menu from its trigger", async () => {
		const onSelect = jest.fn();
		await render(
			<Menubar
				menus={[
					{ key: "file", label: "File", items: [{ value: "new", label: "New tab" }], onSelect },
					{ key: "edit", label: "Edit", items: [{ value: "undo", label: "Undo" }], onSelect: jest.fn() },
				]}
			/>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "File" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "New tab" }));
		expect(onSelect).toHaveBeenCalledWith("new");
	});
});
