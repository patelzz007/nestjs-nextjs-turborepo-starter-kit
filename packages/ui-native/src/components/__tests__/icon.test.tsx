import { render, screen } from "@testing-library/react-native";
import HouseIcon from "lucide-react-native/icons/house";
import * as React from "react";
import type { View } from "react-native";

import { Icon, ICON_SIZES, ICON_STROKE_WIDTHS, iconVariants } from "../icon";

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

	it("sizes its box to the same step as the glyph", () => {
		expect(iconVariants({ size: "sm" })).toContain("size-4");
		expect(iconVariants({ size: "md" })).toContain("size-5");
		expect(iconVariants({ size: "lg" })).toContain("size-6");
		expect(iconVariants({ size: "xl" })).toContain("size-8");
		expect(iconVariants({ size: "2xl" })).toContain("size-10");
	});

	it("forwards its ref to the box and merges the caller's className last", async () => {
		const ref = React.createRef<View>();
		await render(<Icon ref={ref} icon={HouseIcon} size="sm" colorClassName="accent-primary" className="mt-0.5 size-5" testID="icon" />);

		expect(ref.current).not.toBeNull();
		const box = screen.getByTestId("icon", { includeHiddenElements: true }).parent;
		const className = String(box?.props.className);
		expect(className).toContain("mt-0.5");
		expect(className).toContain("size-5");
		expect(className).not.toContain("size-4");
	});
});
