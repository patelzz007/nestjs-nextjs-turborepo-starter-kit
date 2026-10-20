import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";

import { AVATAR_POINTS, Avatar, initialsOf, type AvatarSize } from "../avatar";

const SIZES: readonly AvatarSize[] = ["sm", "md", "lg"];

function classNameOf(testID: string): string {
	return String(screen.getByTestId(testID).props.className);
}

describe("Avatar", () => {
	it("shows the initials without a picture, named for screen readers", async () => {
		await render(<Avatar name="Alex Morgan" imageUrl={null} />);
		expect(screen.getByLabelText("Alex Morgan's initials")).toHaveTextContent("AM");
	});

	it("shows the picture when there is one", async () => {
		await render(<Avatar name="Alex Morgan" imageUrl="https://cdn.example.com/a.png" />);
		expect(screen.getByLabelText("Alex Morgan's profile picture")).toBeOnTheScreen();
		expect(screen.queryByText("AM")).toBeNull();
	});

	it("takes an accessible name other than the default", async () => {
		await render(<Avatar name="Acme" imageUrl="https://cdn.example.com/acme.png" shape="rounded" accessibilityLabel="Acme's logo" />);
		expect(screen.getByLabelText("Acme's logo")).toBeOnTheScreen();
	});

	it.each(SIZES)("draws a %s picture at its size in points", async (size: AvatarSize) => {
		await render(<Avatar name="octocat" imageUrl="https://avatars.githubusercontent.com/u/1" size={size} />);

		const picture = screen.getByLabelText("octocat's profile picture");
		expect(picture).toHaveProp("width", AVATAR_POINTS[size]);
		expect(picture).toHaveProp("height", AVATAR_POINTS[size]);
	});

	it("is round for a person and a rounded square for a tenant", async () => {
		const view = await render(<Avatar name="Alex" imageUrl={null} testID="avatar" />);
		expect(classNameOf("avatar")).toContain("rounded-full");

		await view.rerender(<Avatar name="Acme" imageUrl={null} shape="rounded" size="md" testID="avatar" />);
		expect(classNameOf("avatar")).toContain("rounded-lg");
		expect(classNameOf("avatar")).not.toContain("rounded-full");
	});

	it("inverts its colours on a primary surface", async () => {
		const view = await render(<Avatar name="Alex" imageUrl={null} testID="avatar" />);
		expect(classNameOf("avatar")).toContain("bg-primary");
		expect(screen.getByText("A")).toHaveProp("className", expect.stringContaining("text-primary-foreground"));

		await view.rerender(<Avatar name="Alex" imageUrl={null} tone="inverse" testID="avatar" />);
		expect(classNameOf("avatar")).toContain("bg-primary-foreground");
		expect(screen.getByText("A")).toHaveProp("className", expect.stringContaining("text-primary"));
	});

	it("forwards its ref, with or without a picture", async () => {
		const initialsRef = React.createRef<View>();
		const pictureRef = React.createRef<View>();
		await render(
			<>
				<Avatar ref={initialsRef} name="Alex" imageUrl={null} />
				<Avatar ref={pictureRef} name="Sam" imageUrl="https://cdn.example.com/s.png" />
			</>,
		);
		expect(initialsRef.current).not.toBeNull();
		expect(pictureRef.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<Avatar name="Alex" imageUrl={null} size="sm" className="size-10" testID="avatar" />);
		expect(classNameOf("avatar")).toContain("size-10");
		expect(classNameOf("avatar")).not.toContain("size-6");
	});
});

describe("initialsOf", () => {
	it.each([
		["Alex Morgan", "AM"],
		["alex", "A"],
		["  Ana  Maria  Lopez ", "AM"],
		["", ""],
	])("initials of %j are %j", (name: string, initials: string) => {
		expect(initialsOf(name)).toBe(initials);
	});
});
