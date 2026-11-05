import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { ListGroup } from "../list-group";

function classNameOf(testID: string): string {
	return String(screen.getByTestId(testID, { includeHiddenElements: true }).props.className);
}

/** A group with a row shown only sometimes, as a screen would write it. */
function PreferenceRows({ showLanguage }: { readonly showLanguage: boolean }): React.JSX.Element {
	return (
		<ListGroup testID="group">
			<Text>Appearance</Text>
			{showLanguage ? <Text>Language</Text> : null}
		</ListGroup>
	);
}

describe("ListGroup", () => {
	it("puts its rows on one rounded surface, a hairline between each pair", async () => {
		await render(
			<ListGroup testID="group">
				<Text>Appearance</Text>
				<Text>Language</Text>
				<Text>App lock</Text>
			</ListGroup>,
		);

		expect(screen.getByText("Appearance")).toBeOnTheScreen();
		expect(screen.getByText("App lock")).toBeOnTheScreen();
		expect(classNameOf("group-surface")).toContain("rounded-2xl border border-border bg-card");
		expect(screen.getAllByTestId("group-line", { includeHiddenElements: true })).toHaveLength(2);
	});

	it("leaves no stray line for a row that is not shown", async () => {
		await render(<PreferenceRows showLanguage={false} />);

		expect(screen.queryAllByTestId("group-line", { includeHiddenElements: true })).toHaveLength(0);
	});

	it("names the group above its surface as a header, and adds its note under it", async () => {
		await render(
			<ListGroup title="Preferences" footer="These stay on this phone." testID="group">
				<Text>Appearance</Text>
			</ListGroup>,
		);

		expect(screen.getByRole("header", { name: "Preferences" })).toBeOnTheScreen();
		expect(screen.getByTestId("group-footer")).toHaveTextContent("These stay on this phone.");
	});

	it("shows neither title nor note when none is given", async () => {
		await render(
			<ListGroup testID="group">
				<Text>Appearance</Text>
			</ListGroup>,
		);

		expect(screen.queryByTestId("group-title")).toBeNull();
		expect(screen.queryByTestId("group-footer")).toBeNull();
	});

	it("merges extra classes last and forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(
			<ListGroup ref={ref} className="mt-2" testID="group">
				<Text>Appearance</Text>
			</ListGroup>,
		);

		expect(classNameOf("group")).toContain("gap-2 mt-2");
		expect(ref.current).not.toBeNull();
	});
});
