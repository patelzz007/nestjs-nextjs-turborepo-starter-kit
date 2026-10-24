import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo, type TextInstance, type ViewInstance } from "react-native";
import { z } from "zod";

import { Button } from "../button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, type DialogProps } from "../dialog";

const TITLE = "Rename project";
const DESCRIPTION = "The new name shows everywhere the project is listed.";

function dialog(overrides: Partial<DialogProps> = {}): React.JSX.Element {
	return (
		<Dialog open onOpenChange={jest.fn()} testID="dialog" {...overrides}>
			<DialogHeader>
				<DialogTitle>{TITLE}</DialogTitle>
				<DialogDescription>{DESCRIPTION}</DialogDescription>
			</DialogHeader>
			<DialogFooter>
				<Button label="Save" onPress={jest.fn()} />
			</DialogFooter>
		</Dialog>
	);
}

/** The Modal host element: the rendered tree's root (it carries `onRequestClose` and `animationType`). */
function modal(): NonNullable<typeof screen.root> {
	const { root } = screen;
	if (root === null) {
		throw new Error("Nothing is rendered.");
	}
	return root;
}

/** The scrim sits behind the card, outside `accessibilityViewIsModal`: touch only. */
function scrim(): ReturnType<typeof screen.getByTestId> {
	return screen.getByTestId("dialog-scrim", { includeHiddenElements: true });
}

function classNameOf(testID: string): string {
	return z.string().parse(screen.getByTestId(testID).props.className);
}

describe("Dialog", () => {
	it("is a modal dialog card with a header title and description", async () => {
		await render(dialog());

		const card = screen.getByTestId("dialog");
		expect(card).toHaveProp("role", "dialog");
		expect(card).toHaveProp("accessibilityViewIsModal", true);
		expect(screen.getByRole("header", { name: TITLE })).toBeOnTheScreen();
		expect(screen.getByText(DESCRIPTION)).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Save" })).toBeOnTheScreen();
	});

	it("renders nothing while closed", async () => {
		await render(dialog({ open: false }));
		expect(screen.queryByText(TITLE)).toBeNull();
	});

	it("asks to close from the scrim and from the Android back button", async () => {
		const onOpenChange = jest.fn();
		await render(dialog({ onOpenChange }));

		await fireEvent.press(scrim());
		await fireEvent(modal(), "requestClose");

		expect(onOpenChange).toHaveBeenCalledTimes(2);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
		expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
	});

	it("ignores the scrim when not dismissible, but still closes on back", async () => {
		const onOpenChange = jest.fn();
		await render(dialog({ onOpenChange, dismissible: false }));

		await fireEvent.press(scrim());
		expect(onOpenChange).not.toHaveBeenCalled();
		await fireEvent(modal(), "requestClose");
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("announces busy and refuses to close while loading", async () => {
		const onOpenChange = jest.fn();
		await render(dialog({ onOpenChange, loading: true }));

		expect(screen.getByTestId("dialog")).toBeBusy();
		await fireEvent.press(scrim());
		await fireEvent(modal(), "requestClose");
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("shows the caller's failure as its error state, unless it is busy", async () => {
		const view = await render(dialog({ invalid: true }));
		expect(classNameOf("dialog")).toContain("border-destructive");

		await view.rerender(dialog({ invalid: true, loading: true }));
		expect(classNameOf("dialog")).not.toContain("border-destructive");
	});

	it.each([
		["sm", "max-w-sm"],
		["md", "max-w-md"],
		["lg", "max-w-lg"],
	] satisfies [DialogProps["size"], string][])("has a %s size", async (size, expected) => {
		await render(dialog({ size }));
		expect(classNameOf("dialog")).toContain(expected);
	});

	it("draws a destructive variant and an alert-dialog role", async () => {
		await render(dialog({ variant: "destructive", role: "alertdialog" }));
		expect(classNameOf("dialog")).toContain("border-destructive");
		expect(screen.getByTestId("dialog")).toHaveProp("role", "alertdialog");
	});

	it("fades, and simply appears under Reduce Motion", async () => {
		await render(dialog());
		expect(modal()).toHaveProp("animationType", "fade");

		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		await render(dialog());
		expect(modal()).toHaveProp("animationType", "none");
	});

	it("forwards refs from the dialog and every part", async () => {
		const card = React.createRef<ViewInstance>();
		const header = React.createRef<ViewInstance>();
		const title = React.createRef<TextInstance>();
		const description = React.createRef<TextInstance>();
		const footer = React.createRef<ViewInstance>();
		await render(
			<Dialog ref={card} open onOpenChange={jest.fn()}>
				<DialogHeader ref={header}>
					<DialogTitle ref={title}>{TITLE}</DialogTitle>
					<DialogDescription ref={description}>{DESCRIPTION}</DialogDescription>
				</DialogHeader>
				<DialogFooter ref={footer}>
					<Button label="OK" onPress={jest.fn()} />
				</DialogFooter>
			</Dialog>,
		);

		expect(card.current).not.toBeNull();
		expect(header.current).not.toBeNull();
		expect(title.current).not.toBeNull();
		expect(description.current).not.toBeNull();
		expect(footer.current).not.toBeNull();
	});

	it("merges the caller's className last on the card and the parts", async () => {
		await render(
			<Dialog open onOpenChange={jest.fn()} className="max-w-lg p-8" testID="dialog">
				<DialogHeader className="gap-4" testID="header">
					<DialogTitle className="text-xl" testID="title">
						{TITLE}
					</DialogTitle>
				</DialogHeader>
				<DialogFooter className="flex-row" testID="footer">
					<Button label="OK" onPress={jest.fn()} />
				</DialogFooter>
			</Dialog>,
		);

		const card = classNameOf("dialog");
		expect(card).toContain("p-8");
		expect(card).not.toContain("p-5");
		expect(card).toContain("max-w-lg");
		expect(card).not.toContain("max-w-md");
		expect(classNameOf("header")).toContain("gap-4");
		expect(classNameOf("header")).not.toContain("gap-1.5");
		expect(classNameOf("title")).toContain("text-xl");
		expect(classNameOf("title")).not.toContain("text-lg");
		expect(classNameOf("footer")).toContain("flex-row");
	});
});
