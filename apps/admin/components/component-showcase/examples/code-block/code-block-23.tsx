"use client";

import type * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { CodeBlock, CodeBlockContent, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle, useCodeBlockFolding } from "@workspace/ui/components/code-block";
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";
import { Separator } from "@workspace/ui/components/separator";

const CODE = `export async function syncWorkspace(workspaceId: string) {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } })

  if (!workspace) {
    throw new WorkspaceNotFoundError(workspaceId)
  }

  const members = await db.member.findMany({ where: { workspaceId } })

  for (const member of members) {
    if (member.status === "invited") {
      await mail.send({
        to: member.email,
        template: "workspace-reminder",
      })
    }
  }

  return { synced: members.length }
}`;

/** The `if (member.status === "invited")` branch inside the loop, by source line. */
const INNER_BRANCH_LINE = 11;

/* Opens with the inner branch folded, so the nesting is visible at a glance:
   folding line 10 swallows it, and unfolding 10 brings it back still folded. */
const INITIALLY_FOLDED: number[] = [INNER_BRANCH_LINE];

/*
 * The block detects its own regions from indentation, and `useCodeBlockFolding`
 * hands composed chrome those regions plus "fold all" / "unfold all", so the
 * header never keeps a second, hand-written list of where regions start.
 */
function FoldControls(): React.JSX.Element {
	const { foldedStarts, foldAll, unfoldAll } = useCodeBlockFolding();

	return (
		<>
			<Button size="xs" variant="ghost" onClick={foldAll}>
				Fold all
			</Button>
			<Button size="xs" variant="ghost" disabled={foldedStarts.length === 0} onClick={unfoldAll}>
				Unfold all
			</Button>
		</>
	);
}

/*
 * The ScrollArea composes INSIDE the block, under the header, so the fold
 * controls never scroll away and the block's own chrome stays the container.
 */
export function CodeBlock23Example(): React.JSX.Element {
	return (
		<CodeBlock code={CODE} language="typescript" showLineNumbers className="w-full max-w-2xl" foldable defaultFolded={INITIALLY_FOLDED}>
			<CodeBlockHeader className="gap-1.5">
				<CodeBlockTitle>sync-workspace.ts</CodeBlockTitle>
				<div className="ml-auto flex items-center gap-1">
					<FoldControls />
					<Separator orientation="vertical" className="h-4" />
					<CodeBlockCopyButton />
				</div>
			</CodeBlockHeader>
			<ScrollArea className="rounded-[inherit] **:data-[slot=scroll-area-viewport]:max-h-72">
				<CodeBlockContent />
				<ScrollBar orientation="horizontal" />
			</ScrollArea>
		</CodeBlock>
	);
}
