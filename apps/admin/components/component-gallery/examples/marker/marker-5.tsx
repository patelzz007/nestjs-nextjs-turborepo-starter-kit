import * as React from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui/components/marker";

interface Change {
	path: string;
	kind: "added" | "modified" | "removed";
	delta: string;
}

const CHANGES: Change[] = [
	{ path: "src/lib/rate-limit.ts", kind: "added", delta: "+64" },
	{ path: "src/app/api/send/route.ts", kind: "modified", delta: "+18 -4" },
	{ path: "src/db/schema.ts", kind: "modified", delta: "+6 -1" },
	{ path: "src/lib/legacy-throttle.ts", kind: "removed", delta: "-91" },
	{ path: "README.md", kind: "modified", delta: "+3" },
];

// Both maps are written out per kind rather than assembled from the kind
// string, so every icon library prop stays a literal the registry installer
// can rewrite and every badge variant stays one the design system declares.
const ICONS: Record<Change["kind"], ReactNode> = {
	added: <PlusIcon />,
	modified: <PencilIcon />,
	removed: <Trash2Icon />,
};

const BADGES: Record<Change["kind"], "success-light" | "info-light" | "destructive-light"> = {
	added: "success-light",
	modified: "info-light",
	removed: "destructive-light",
};

// The border variant rules off a row from the one BELOW it, so the last row
// drops back to the default: leaving it on ends the list on a line with
// nothing under it, which reads as a missing sixth file.
//
// The path is its own block level span because truncation needs a block box to
// apply to, and it carries a title so the tail a narrow card clips is still
// recoverable.
//
// The auto margin belongs on the badge, not on the delta: on the delta alone
// each badge trails its own path, and five paths of five lengths read ragged.
export function Marker5Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-2">
			{CHANGES.map((change, index) => (
				<Marker key={change.path} variant={index < CHANGES.length - 1 ? "border" : "default"}>
					<MarkerIcon>{ICONS[change.kind]}</MarkerIcon>
					<MarkerContent>
						<span className="block truncate font-mono text-xs" title={change.path}>
							{change.path}
						</span>
					</MarkerContent>
					<Badge className="ms-auto" variant={BADGES[change.kind]}>
						{change.kind}
					</Badge>
					<span className="shrink-0 text-xs tabular-nums">{change.delta}</span>
				</Marker>
			))}
		</div>
	);
}
