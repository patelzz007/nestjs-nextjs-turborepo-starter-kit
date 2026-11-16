import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Avatar } from "../avatar";
import { AvatarGroup } from "../avatar-group";

const PEOPLE: readonly string[] = ["Ava Patel", "Leo Kim", "Mia Chen"];

function avatars(): React.JSX.Element[] {
	return PEOPLE.map((name: string): React.JSX.Element => <Avatar key={name} name={name} imageUrl={null} size="md" />);
}

describe("AvatarGroup", () => {
	it("is one image named for who is in it, overlapping its avatars and ending in a count of the others", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(
			<AvatarGroup ref={ref} label="Ava, Leo, Mia and 5 others" extra={5} testID="group">
				{avatars()}
			</AvatarGroup>,
		);
		expect(screen.getByRole("image", { name: "Ava, Leo, Mia and 5 others" })).toBeOnTheScreen();
		expect(screen.getByText("+5")).toBeOnTheScreen();
		expect(ref.current).not.toBeNull();
	});

	it("ends in a plus, in nothing, or spreads the avatars apart", async () => {
		const { rerender } = await render(
			<AvatarGroup label="Team" countDisplay="plus" size="sm" testID="group">
				{avatars()}
			</AvatarGroup>,
		);
		expect(screen.queryByText(/^\+/u)).toBeNull();
		await rerender(
			<AvatarGroup label="Team" spread countDisplay="plus" size="lg">
				{avatars()}
			</AvatarGroup>,
		);
		expect(screen.getByRole("image", { name: "Team" })).toBeOnTheScreen();
		await rerender(<AvatarGroup label="Team">{avatars()}</AvatarGroup>);
		expect(screen.queryByText(/^\+/u)).toBeNull();
	});
});
