"use client";

import { XIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import {
	CodeBlock,
	CodeBlockContent,
	CodeBlockCopyButton,
	CodeBlockHeader,
	CodeBlockTitle,
	useCodeBlockConfig,
	type CodeBlockWordSpec,
} from "@workspace/ui/components/code-block";
import { Input } from "@workspace/ui/components/input";
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";

const CODE = `export async function createInvite(workspaceId: string, email: string) {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) throw new WorkspaceNotFoundError(workspaceId)

  const seats = await countBillableSeats(workspaceId)
  if (seats.used >= seats.total) {
    throw new SeatLimitError(workspaceId, seats.total)
  }

  const invite = await db.invite.create({
    data: { workspaceId, email, status: "pending" },
  })

  await mail.send({ to: email, template: "workspace-invite" })
  return invite
}`;

/** A shorter query would mark almost every line, so search waits for this many characters. */
const MIN_QUERY_LENGTH = 2;

const INITIAL_QUERY = "workspace";

/** The trimmed query when it is long enough to search for, otherwise `null`. */
function searchable(query: string): string | null {
	const needle = query.trim();
	return needle.length < MIN_QUERY_LENGTH ? null : needle;
}

interface MatchCountProps {
	readonly query: string;
}

/**
 * The counter takes no `code` prop: `useCodeBlockConfig` hands it the block's
 * own source, so a control composed into the header cannot drift from what the
 * block actually renders.
 *
 * Counting is case SENSITIVE on purpose. `highlightedWords` marks exact
 * matches, so a case-insensitive count reports 11 where the block paints 10
 * and the header quietly contradicts the code under it.
 */
function MatchCount({ query }: MatchCountProps): React.JSX.Element | null {
	const { code: source } = useCodeBlockConfig("MatchCount");

	const matches = React.useMemo((): number | null => {
		const needle = searchable(query);
		return needle === null ? null : source.split(needle).length - 1;
	}, [source, query]);

	if (matches === null) {
		return null;
	}

	return (
		<Badge variant={matches > 0 ? "primary-light" : "secondary"}>
			{matches} {matches === 1 ? "match" : "matches"}
		</Badge>
	);
}

export function CodeBlock13Example(): React.JSX.Element {
	const [query, setQuery] = React.useState(INITIAL_QUERY);

	/* `highlightedWords` is a spec, not a regex: a query under two characters
	   would mark almost every line, so it stays empty until the search is worth
	   rendering. */
	const words = React.useMemo((): CodeBlockWordSpec[] | undefined => {
		const needle = searchable(query);
		return needle === null ? undefined : [needle];
	}, [query]);

	const handleQueryChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setQuery(event.target.value);
	}, []);

	const handleClear = React.useCallback((): void => {
		setQuery("");
	}, []);

	return (
		<CodeBlock code={CODE} language="typescript" showLineNumbers highlightedWords={words} className="w-full max-w-2xl">
			<CodeBlockHeader className="gap-2">
				<CodeBlockTitle>invites.ts</CodeBlockTitle>
				<div className="ml-auto flex items-center gap-2">
					<MatchCount query={query} />
					{/* The group joins the field to its clear button into one control,
					    so the header keeps a single bordered shape rather than two. */}
					<ButtonGroup>
						<Input type="search" value={query} aria-label="Search in file" placeholder="Search" onChange={handleQueryChange} className="w-40 text-xs" />
						<Button variant="outline" size="icon" aria-label="Clear search" disabled={query === ""} onClick={handleClear}>
							<XIcon />
						</Button>
					</ButtonGroup>
				</div>
			</CodeBlockHeader>

			{/* Pinned over the code: the header is already carrying the search
			    control, so the copy affordance moves onto the surface itself. */}
			<CodeBlockCopyButton variant="outline" size="icon-xs" className="bg-card hover:bg-muted" />
			<ScrollArea className="rounded-[inherit] **:data-[slot=scroll-area-viewport]:max-h-72">
				<CodeBlockContent />
				<ScrollBar orientation="horizontal" />
			</ScrollArea>
		</CodeBlock>
	);
}
