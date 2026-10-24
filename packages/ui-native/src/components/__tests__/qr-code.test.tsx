import { render, screen } from "@testing-library/react-native";
import { encodeQr, qrMatrixToSvgPath } from "@workspace/shared";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { QR_CODE_SIZES, QrCode } from "../qr-code";

const VALUE = "https://rewards.example.com/redeem/RWD-4821";

describe("QrCode", () => {
	it("is one image named by the caller", async () => {
		await render(<QrCode value={VALUE} label="Reward redemption QR code" />);
		expect(screen.getByRole("image", { name: "Reward redemption QR code" })).toBeOnTheScreen();
	});

	it("draws the code at its size's edge, coloured from the QR tokens", async () => {
		await render(<QrCode value={VALUE} label="QR" size="lg" testID="qr" />);

		const tile = screen.getByTestId("qr");
		expect(tile).toHaveProp("className", expect.stringContaining("bg-qr-background"));
		expect(tile).toHaveProp("className", expect.stringContaining("p-4"));
		// The drawing: react-native-svg's view, the one element inside the tile that has a width.
		const [code] = tile.queryAll((instance): boolean => instance.props.width !== undefined);
		if (code === undefined) {
			throw new Error("The QR tile has no drawing");
		}
		expect(code).toHaveProp("width", QR_CODE_SIZES.lg);
		expect(code).toHaveProp("height", QR_CODE_SIZES.lg);
		// Uniwind (a pass-through under Jest) turns this token utility into the modules' colour on a device.
		expect(code).toHaveProp("colorClassName", "accent-qr-foreground");
	});

	it("draws the shared encoder's modules as one currentColor path, with no inner quiet zone", async () => {
		await render(<QrCode value={VALUE} label="QR" testID="qr" />);

		const expected = qrMatrixToSvgPath(encodeQr(VALUE), { quietZoneModules: 0 });
		const paths = screen.getByTestId("qr").queryAll((instance): boolean => instance.props.d !== undefined);
		const uniquePaths = new Set(paths.map((instance): string => String(instance.props.d)));
		expect([...uniquePaths]).toEqual([expected.path]);
		const [path] = paths;
		// react-native-svg hands `fill="currentColor"` to the native view as its currentColor brush.
		expect(path).toHaveProp("fill", { type: 2 });
		// react-native-svg splits `viewBox` into its parts on the native view.
		const [drawing] = screen.getByTestId("qr").queryAll((instance): boolean => instance.props.vbWidth !== undefined);
		expect(drawing).toHaveProp("minX", 0);
		expect(drawing).toHaveProp("vbWidth", expected.viewBoxSize);
		expect(drawing).toHaveProp("vbHeight", expected.viewBoxSize);
	});

	it("redraws when the value changes", async () => {
		const pathOf = (): string => {
			const [path] = screen.getByTestId("qr").queryAll((instance): boolean => instance.props.d !== undefined);
			return String(path?.props.d);
		};
		await render(<QrCode value="first" label="QR" testID="qr" />);
		const first = pathOf();
		await render(<QrCode value="second" label="QR" testID="qr" />);
		expect(pathOf()).not.toBe(first);
	});

	it.each([
		["sm", "p-2"],
		["md", "p-3"],
		["lg", "p-4"],
	] satisfies [React.ComponentProps<typeof QrCode>["size"], string][])("has a %s size", async (size, padding) => {
		await render(<QrCode value={VALUE} label="QR" size={size} testID="qr" />);
		expect(screen.getByTestId("qr")).toHaveProp("className", expect.stringContaining(padding));
	});

	it("is a bordered tile by default, or plain inside the caller's frame", async () => {
		await render(<QrCode value={VALUE} label="Framed" testID="framed" />);
		expect(screen.getByTestId("framed")).toHaveProp("className", expect.stringContaining("border-border"));

		await render(<QrCode value={VALUE} label="Plain" variant="plain" testID="plain" />);
		expect(screen.getByTestId("plain")).not.toHaveProp("className", expect.stringContaining("border-border"));
	});

	it("merges the caller's className last", async () => {
		await render(<QrCode value={VALUE} label="QR" className="self-center p-6" testID="qr" />);
		const className = String(screen.getByTestId("qr").props.className);
		expect(className).toContain("self-center");
		expect(className).toContain("p-6");
		expect(className).not.toContain("p-3");
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<QrCode ref={ref} value={VALUE} label="QR" />);
		expect(ref.current).not.toBeNull();
	});
});
