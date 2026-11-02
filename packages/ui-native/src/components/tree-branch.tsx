// The children of one node of a tree, indented under it and hung from a
// vertical guide line: each child gets an elbow from the guide to its control
// (the middle of its first 44pt row), and the guide runs on to the next child,
// stopping at the last one. Data-agnostic: it lays out whatever nodes it is
// given (a node may hold its own branch); start each child with its control
// row and put any notes under it. Place it so its start edge sits under the
// parent's control (`ml-*`); the guide runs from there.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";

/**
 * A child's guide column, in pieces that never overlap, so the see-through colour is even everywhere (darker
 * than the card in light mode, brighter in dark mode). Every child but the last gets `line`, the guide running
 * its full height, and `arm`, which starts a point to the right of the line and reaches the child's control
 * at 22pt — the middle of the kit's 44pt touch row (`min-h-11`). The last child gets `elbow` alone: the guide
 * curving into the arm at the same 22pt, and stopping there.
 */
export const treeBranchGuideVariants = cva("absolute border-muted-foreground/50", {
	variants: {
		segment: {
			line: "top-0 bottom-0 left-0 border-l",
			arm: "top-0 right-0 left-px h-5.5 border-b",
			elbow: "top-0 right-0 left-0 h-5.5 rounded-bl-md border-b border-l",
		},
	},
	defaultVariants: { segment: "elbow" },
});

export type TreeBranchGuideSegment = NonNullable<VariantProps<typeof treeBranchGuideVariants>["segment"]>;

export interface TreeBranchProps {
	/** The branch's children, one per node; empty children are skipped. */
	readonly children: React.ReactNode;
	/** Names the branch for screen readers: usually the parent's name. */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the branch, merged last (its indent, `ml-*`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const TreeBranch = React.memo(
	React.forwardRef<ViewInstance, TreeBranchProps>(function TreeBranch({ children, accessibilityLabel, className, testID }, ref): React.JSX.Element {
		const nodes = React.Children.toArray(children);
		const lastIndex = nodes.length - 1;
		return (
			<View ref={ref} accessibilityRole="list" accessibilityLabel={accessibilityLabel} testID={testID} className={cn("gap-0", className)}>
				{/* `map` keys each item after its child. */}
				{React.Children.map(nodes, (child, index): React.JSX.Element => (
					<View className="flex-row" testID={testID === undefined ? undefined : `${testID}-item`}>
						<View className="w-4">
							{index === lastIndex ? (
								<View className={treeBranchGuideVariants({ segment: "elbow" })} />
							) : (
								<>
									<View className={treeBranchGuideVariants({ segment: "line" })} />
									<View className={treeBranchGuideVariants({ segment: "arm" })} />
								</>
							)}
						</View>
						<View className="flex-1 pl-2">{child}</View>
					</View>
				))}
			</View>
		);
	}),
);
