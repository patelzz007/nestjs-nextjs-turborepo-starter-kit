import { render, screen } from "@testing-library/react-native";
import HouseIcon from "lucide-react-native/icons/house";
import * as React from "react";

import { Icon, ICON_SIZES, ICON_STROKE_WIDTHS } from "./icon";

describe("Icon", () => {
	it("draws the glyph at the default size and the regular weight", async () => {
		await render(<Icon icon={HouseIcon} colorClassName="accent-primary" testID="icon" />);

		const icon = screen.getByTestId("icon", { includeHiddenElements: true });
		expect(icon).toHaveProp("width", ICON_SIZES.lg);
		expect(icon).toHaveProp("strokeWidth", ICON_STROKE_WIDTHS.regular);
	});

	it("takes a size step and a weight", async () => {
		await render(<Icon icon={HouseIcon} size="xl" weight="bold" colorClassName="accent-muted-foreground" testID="icon" />);

		const icon = screen.getByTestId("icon", { includeHiddenElements: true });
		expect(icon).toHaveProp("width", ICON_SIZES.xl);
		expect(icon).toHaveProp("strokeWidth", ICON_STROKE_WIDTHS.bold);
	});

	it("keeps one ascending size scale and a heavier bold stroke", () => {
		expect([ICON_SIZES.sm, ICON_SIZES.md, ICON_SIZES.lg, ICON_SIZES.xl, ICON_SIZES["2xl"]]).toStrictEqual([16, 20, 24, 32, 40]);
		expect(ICON_STROKE_WIDTHS.bold).toBeGreaterThan(ICON_STROKE_WIDTHS.regular);
	});
});
