import * as React from "react";
import { BookOpenIcon, FileTextIcon, GitBranchIcon, PencilIcon, SearchIcon, TerminalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui/components/marker";

interface ToolCall {
	id: string;
	label: string;
	icon: ReactNode;
}

// Each row carries a finished icon element rather than an icon name, because
// every library prop below has to stay a literal string for the registry
// installer to rewrite it. A name looked up from the row would not survive.
//
// None of them takes a size class either. A marker sizes a plain svg child for
// you, and that size is smaller in the compact styles, so a fixed size here
// pins one icon to one style's scale and looks wrong in the rest.
const TOOL_CALLS: ToolCall[] = [
	{
		id: "checkout",
		label: "Checked out fix/rate-limit-window",
		icon: <GitBranchIcon />,
	},
	{
		id: "search",
		label: "Searched 214 files for rateLimit(",
		icon: <SearchIcon />,
	},
	{
		id: "read",
		label: "Read src/lib/rate-limit.ts",
		icon: <FileTextIcon />,
	},
	{
		id: "edit",
		label: "Edited src/lib/rate-limit.ts, 2 hunks",
		icon: <PencilIcon />,
	},
	{
		id: "test",
		label: "Ran pnpm test rate-limit",
		icon: <TerminalIcon />,
	},
	{
		id: "docs",
		label: "Read the Upstash quota docs",
		icon: <BookOpenIcon />,
	},
];

// The icon slot is hidden from assistive tech by the primitive, along with
// everything inside it, so the label alone has to read as a complete line of
// the log. No row here says "this one" or leans on its glyph for meaning.
//
// No panel around the list on purpose: the default variant is chrome free, and
// wrapping it in a card would demonstrate the card instead of the icon slot.
export function Marker2Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-3">
			{TOOL_CALLS.map((call) => (
				<Marker key={call.id}>
					<MarkerIcon>{call.icon}</MarkerIcon>
					<MarkerContent>{call.label}</MarkerContent>
				</Marker>
			))}
		</div>
	);
}
