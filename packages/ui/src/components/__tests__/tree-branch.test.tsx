// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { TreeBranch, TreeNodeText, treeBranchItemVariants } from "../tree-branch";

afterEach((): void => {
	cleanup();
});

/** A branch whose last child is there only when asked for, as a screen's would be. */
function AccountBranch({ showSms }: { readonly showSms: boolean }): React.JSX.Element {
	return (
		<TreeBranch aria-label="Account" className="ms-8">
			<span>In the app</span>
			<span>Email</span>
			{showSms ? <span>SMS</span> : null}
		</TreeBranch>
	);
}

describe("TreeBranch", () => {
	it("forwards its ref to the list", (): void => {
		const ref = React.createRef<HTMLUListElement>();
		render(
			<TreeBranch ref={ref} aria-label="Account">
				<span>Email</span>
			</TreeBranch>,
		);
		expect(ref.current?.dataset.slot).toBe("tree-branch");
	});

	it("hangs each child from the guide, one list item each, skipping empty children", (): void => {
		render(<AccountBranch showSms={false} />);
		const list = screen.getByRole("list", { name: "Account" });
		expect(list.className).toContain("ms-8");
		const items = within(list).getAllByRole("listitem");
		expect(items.map((item) => item.textContent)).toEqual(["In the app", "Email"]);
		for (const item of items) {
			expect(item.className).toBe(treeBranchItemVariants());
		}
	});

	it("hangs every child but the last from a full-height guide with an arm, and the last from one curved elbow", (): void => {
		const classes = treeBranchItemVariants();
		expect(classes).toContain("after:top-0");
		expect(classes).toContain("after:bottom-0");
		expect(classes).toContain("before:h-1/2");
		expect(classes).toContain("before:border-b");
		expect(classes).toContain("last:after:hidden");
		expect(classes).toContain("last:before:rounded-es-md");
		expect(classes).toContain("last:before:border-s");
		expect(classes).toContain("ps-6");
	});

	it("draws pieces that never overlap, so the see-through colour stays even", (): void => {
		const classes = treeBranchItemVariants().split(" ");
		// The arm starts a pixel right of the guide and has no side border of its own, except as the last elbow.
		expect(classes).toContain("before:start-px");
		expect(classes).not.toContain("before:border-s");
		expect(classes).toContain("before:border-muted-foreground/50");
		expect(classes).toContain("after:border-muted-foreground/50");
	});
});

describe("TreeNodeText", () => {
	it("shows the node's title and, under it, its subtitle", (): void => {
		render(<TreeNodeText title="Email" description="To your sign-in email address" />);
		const title = screen.getByText("Email");
		const description = screen.getByText("To your sign-in email address");
		expect(title.dataset.slot).toBe("tree-node-title");
		expect(description.dataset.slot).toBe("tree-node-description");
		expect(title.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(title.className).toContain("text-foreground");
	});

	it("fades the title of a node that can't be changed yet", (): void => {
		render(<TreeNodeText title="SMS" description="Add and verify your phone number first" muted />);
		expect(screen.getByText("SMS").className).toContain("text-muted-foreground");
	});
});
