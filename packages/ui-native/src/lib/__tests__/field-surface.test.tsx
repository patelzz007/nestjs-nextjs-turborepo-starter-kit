import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { FIELD_SURFACE_FILL, FieldSurfaceProvider, useFieldSurface } from "../field-surface";

function ShowSurface(): React.JSX.Element {
	return <Text className="text-body font-sans">{useFieldSurface()}</Text>;
}

describe("field surface", () => {
	it("is the page outside any surface", async () => {
		await render(<ShowSurface />);
		expect(screen.getByText("page")).toBeOnTheScreen();
	});

	it("is the nearest surface a provider declares", async () => {
		await render(
			<FieldSurfaceProvider surface="card">
				<FieldSurfaceProvider surface="popover">
					<ShowSurface />
				</FieldSurfaceProvider>
			</FieldSurfaceProvider>,
		);
		expect(screen.getByText("popover")).toBeOnTheScreen();
	});

	it("fills a field with its surface's own colour token", () => {
		expect(FIELD_SURFACE_FILL).toStrictEqual({ page: "bg-background", card: "bg-card", popover: "bg-popover" });
	});
});
