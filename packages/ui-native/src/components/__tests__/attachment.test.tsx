import { fireEvent, render, screen } from "@testing-library/react-native";
import ImageIcon from "lucide-react-native/icons/image";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Attachment } from "../attachment";

const NAME = "quarterly-report.pdf";
const DETAIL = "2.4 MB · PDF";

describe("Attachment", () => {
	it("is a button named by the file and its detail when it opens the file", async () => {
		const onPress = jest.fn();
		await render(<Attachment name={NAME} description={DETAIL} onPress={onPress} accessibilityHint="Opens the file" />);

		const chip = screen.getByRole("button", { name: `${NAME}, ${DETAIL}` });
		await fireEvent.press(chip);
		expect(onPress).toHaveBeenCalledTimes(1);
		expect(screen.getByText(NAME)).toHaveProp("numberOfLines", 1);
	});

	it("is not pressable without onPress, and still names the file", async () => {
		await render(<Attachment name={NAME} />);
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByLabelText(NAME)).toBeOnTheScreen();
	});

	it("reports removal through its own named button", async () => {
		const onRemove = jest.fn();
		await render(<Attachment name={NAME} onRemove={onRemove} />);

		await fireEvent.press(screen.getByRole("button", { name: `Remove ${NAME}` }));
		expect(onRemove).toHaveBeenCalledTimes(1);
	});

	it("takes the caller's remove label and glyph", async () => {
		await render(<Attachment name="photo.jpg" icon={ImageIcon} onRemove={jest.fn()} labels={{ remove: (name: string): string => `Delete ${name}` }} />);
		expect(screen.getByRole("button", { name: "Delete photo.jpg" })).toBeOnTheScreen();
	});

	it("is busy while uploading: opening is blocked, removing (cancelling) is not", async () => {
		const onPress = jest.fn();
		const onRemove = jest.fn();
		await render(<Attachment name={NAME} description="Uploading… 40%" onPress={onPress} onRemove={onRemove} loading />);

		const chip = screen.getByRole("button", { name: `${NAME}, Uploading… 40%` });
		expect(chip).toBeBusy();
		expect(chip).toBeDisabled();
		await fireEvent.press(chip);
		expect(onPress).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: `Remove ${NAME}` }));
		expect(onRemove).toHaveBeenCalledTimes(1);
	});

	it("blocks both actions when disabled", async () => {
		await render(<Attachment name={NAME} onPress={jest.fn()} onRemove={jest.fn()} disabled testID="chip" />);
		expect(screen.getByRole("button", { name: NAME })).toBeDisabled();
		expect(screen.getByRole("button", { name: `Remove ${NAME}` })).toBeDisabled();
		expect(screen.getByTestId("chip")).toHaveProp("className", expect.stringContaining("opacity-60"));
	});

	it("shows the caller's failure as its error state, unless it is inactive", async () => {
		await render(<Attachment name={NAME} description="Upload failed" invalid testID="failed" />);
		expect(screen.getByTestId("failed")).toHaveProp("className", expect.stringContaining("border-destructive"));
		expect(screen.getByText("Upload failed")).toHaveProp("className", expect.stringContaining("text-destructive-foreground"));

		await render(<Attachment name={NAME} invalid disabled testID="inactive" />);
		expect(screen.getByTestId("inactive")).not.toHaveProp("className", expect.stringContaining("border-destructive"));
	});

	it("has a muted variant and a compact size", async () => {
		await render(<Attachment name={NAME} variant="muted" size="sm" testID="chip" />);
		const className = String(screen.getByTestId("chip").props.className);
		expect(className).toContain("bg-muted");
		expect(className).toContain("min-h-11");
		expect(screen.getByText(NAME)).toHaveProp("className", expect.stringContaining("text-xs"));
	});

	it("merges the caller's className last", async () => {
		await render(<Attachment name={NAME} className="w-full rounded-md" testID="chip" />);
		const className = String(screen.getByTestId("chip").props.className);
		expect(className).toContain("w-full");
		expect(className).toContain("rounded-md");
		expect(className).not.toContain("rounded-xl");
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Attachment ref={ref} name={NAME} />);
		expect(ref.current).not.toBeNull();
	});
});
