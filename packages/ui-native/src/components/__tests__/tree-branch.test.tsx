import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { TreeBranch, treeBranchGuideVariants } from "../tree-branch";

/** A branch whose last child is there only when asked for, as a screen's would be. */
function AccountBranch({ showSms }: { readonly showSms: boolean }): React.JSX.Element {
	return (
		<TreeBranch accessibilityLabel="Account" testID="branch">
			<Text>In the app</Text>
			<Text>Email</Text>
			{showSms ? <Text>SMS</Text> : null}
		</TreeBranch>
	);
}

describe("TreeBranch", () => {
	it("is a list named by its parent, one item per child, skipping empty children", async () => {
		await render(<AccountBranch showSms={false} />);

		const branch = screen.getByTestId("branch");
		expect(branch).toHaveProp("accessibilityRole", "list");
		expect(branch).toHaveProp("accessibilityLabel", "Account");
		expect(screen.getAllByTestId("branch-item")).toHaveLength(2);
		expect(screen.getByText("In the app")).toBeOnTheScreen();
		expect(screen.queryByText("SMS")).toBeNull();
	});

	it("hangs every child but the last from a straight line with an arm, and the last from one curved elbow", async () => {
		await render(<AccountBranch showSms />);

		const tree = JSON.stringify(screen.toJSON());
		const count = (segment: "line" | "arm" | "elbow"): number => tree.split(`"${treeBranchGuideVariants({ segment })}"`).length - 1;
		expect(count("line")).toBe(2);
		expect(count("arm")).toBe(2);
		expect(count("elbow")).toBe(1);
	});

	it("draws pieces that never overlap, so the see-through colour stays even", () => {
		// The arm starts a point right of the line; a child gets either the line and arm, or the elbow.
		expect(treeBranchGuideVariants({ segment: "line" })).toContain("left-0");
		expect(treeBranchGuideVariants({ segment: "arm" })).toContain("left-px");
		expect(treeBranchGuideVariants({ segment: "arm" })).not.toContain("border-l");
		expect(treeBranchGuideVariants({ segment: "elbow" })).toContain("rounded-bl-md");
		expect(treeBranchGuideVariants({ segment: "elbow" })).toContain("border-muted-foreground/50");
	});

	it("aims the arm and the elbow at the middle of a 44pt row", () => {
		expect(treeBranchGuideVariants({ segment: "arm" })).toContain("h-5.5");
		expect(treeBranchGuideVariants({ segment: "elbow" })).toContain("h-5.5");
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(
			<TreeBranch ref={ref} className="ml-7" testID="branch">
				<Text>Email</Text>
			</TreeBranch>,
		);
		expect(ref.current).not.toBeNull();
		expect(String(screen.getByTestId("branch").props.className)).toContain("ml-7");
	});
});
