import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import * as React from "react";

/**
 * Each child of a branch, indented past its guide, drawn in pieces that never overlap so the see-through
 * colour is even everywhere (darker than the card in light mode, brighter in dark mode). Every child but the
 * last: `after` is the guide running its full height, and `before` is the arm to the child's middle, starting
 * a pixel right of the guide. The last child: `before` becomes the elbow (the guide curving into the arm) and
 * `after` is hidden. Logical properties, so RTL mirrors it.
 */
export const treeBranchItemVariants = cva(
	"relative ps-6 before:pointer-events-none before:absolute before:start-px before:top-0 before:h-1/2 before:w-[calc(--spacing(4)-1px)] before:border-b before:border-muted-foreground/50 after:pointer-events-none after:absolute after:start-0 after:top-0 after:bottom-0 after:border-s after:border-muted-foreground/50 last:before:start-0 last:before:w-4 last:before:rounded-es-md last:before:border-s last:after:hidden",
);

export interface TreeBranchProps extends Omit<React.ComponentProps<"ul">, "children"> {
	/** The branch's children, one per node; each is drawn hanging from the guide. */
	readonly children: React.ReactNode;
}

/**
 * The children of one node of a tree, indented under it and hung from a vertical guide line. Data-agnostic:
 * it lays out whatever nodes it is given (a node may hold its own `TreeBranch`). Place it so its start edge
 * sits under the parent's control (`ms-*`); the guide runs from there. Give it an `aria-label` naming the parent.
 */
const TreeBranch = React.forwardRef<HTMLUListElement, TreeBranchProps>(function TreeBranch({ className, children, ...props }, ref): React.JSX.Element {
	return (
		<ul ref={ref} data-slot="tree-branch" className={cn("flex flex-col", className)} {...props}>
			{/* `toArray` drops empty children; `map` keys each item after its child. */}
			{React.Children.map(React.Children.toArray(children), (child): React.JSX.Element => (
				<li data-slot="tree-branch-item" className={treeBranchItemVariants()}>
					{child}
				</li>
			))}
		</ul>
	);
});

export { TreeBranch };
