"use client";

import * as React from "react";
import { FileTextIcon, FolderIcon } from "lucide-react";
import { useState } from "react";
import { Cascader, CascaderContent, CascaderEmpty, CascaderList, CascaderPanel, CascaderStatus, CascaderTrigger } from "@workspace/ui/components/cascader/cascader";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNode } from "@workspace/ui/components/cascader/cascader-types";

import { Button } from "@workspace/ui/components/button";

/** The trigger collapses longer paths to their last segments. */
const TRIGGER_MAX_SEGMENTS = 3;

/**
 * No `size-*` class on either glyph, and that is the whole alignment fix.
 * Every style sizes a bare icon through `[&_svg:not([class*='size-'])]` on
 * both the cascader row and the cascader trigger - 16px in nova, vega,
 * maia, luma, rhea and lyra, 14px in mira and sera - and that guard stops
 * matching the moment a size class is present. A hardcoded `size-4` pinned
 * these two at 16px while the trigger chevron and the path chevrons beside
 * them still scaled with the style, and in the compact styles the pinned
 * glyph was tall enough to drive the trigger row's height rather than sit
 * inside the label's line box. `CascaderValue` centres its own row, so the
 * glyph needs a size that tracks the text, not an alignment class.
 */
const folderIcon = <FolderIcon aria-hidden="true" />;
const fileIcon = <FileTextIcon aria-hidden="true" />;

const tree: CascaderNode[] = [
	{
		value: "app",
		label: "app",
		icon: folderIcon,
		children: [
			{
				value: "app/dashboard",
				label: "dashboard",
				icon: folderIcon,
				children: [
					{
						value: "app/dashboard/page.tsx",
						label: "page.tsx",
						icon: fileIcon,
					},
					{
						value: "app/dashboard/layout.tsx",
						label: "layout.tsx",
						icon: fileIcon,
					},
				],
			},
			{
				value: "app/settings",
				label: "settings",
				icon: folderIcon,
				children: [
					{ value: "app/settings/page.tsx", label: "page.tsx", icon: fileIcon },
					{
						value: "app/settings/billing.tsx",
						label: "billing.tsx",
						icon: fileIcon,
					},
				],
			},
			{ value: "app/layout.tsx", label: "layout.tsx", icon: fileIcon },
		],
	},
	{
		value: "components",
		label: "components",
		icon: folderIcon,
		children: [
			{ value: "components/button.tsx", label: "button.tsx", icon: fileIcon },
			{
				value: "components/page-header.tsx",
				label: "page-header.tsx",
				icon: fileIcon,
			},
			{
				value: "components/data-table.tsx",
				label: "data-table.tsx",
				icon: fileIcon,
			},
		],
	},
	{
		value: "hooks",
		label: "hooks",
		icon: folderIcon,
		children: [
			{ value: "hooks/use-user.ts", label: "use-user.ts", icon: fileIcon },
			{ value: "hooks/use-toast.ts", label: "use-toast.ts", icon: fileIcon },
		],
	},
	{
		value: "lib",
		label: "lib",
		icon: folderIcon,
		children: [
			{ value: "lib/utils.ts", label: "utils.ts", icon: fileIcon },
			{ value: "lib/auth.ts", label: "auth.ts", icon: fileIcon },
			{ value: "lib/db.ts", label: "db.ts", icon: fileIcon },
		],
	},
	{
		value: "server",
		label: "server",
		icon: folderIcon,
		children: [
			{
				value: "server/actions",
				label: "actions",
				icon: folderIcon,
				children: [
					{
						value: "server/actions/billing.ts",
						label: "billing.ts",
						icon: fileIcon,
					},
					{
						value: "server/actions/invite.ts",
						label: "invite.ts",
						icon: fileIcon,
					},
				],
			},
			{ value: "server/client.ts", label: "client.ts", icon: fileIcon },
		],
	},
	{
		value: "styles",
		label: "styles",
		icon: folderIcon,
		children: [
			{ value: "styles/globals.css", label: "globals.css", icon: fileIcon },
			{ value: "styles/theme.css", label: "theme.css", icon: fileIcon },
		],
	},
	{
		value: "tests",
		label: "tests",
		icon: folderIcon,
		children: [
			{ value: "tests/auth.test.ts", label: "auth.test.ts", icon: fileIcon },
			{
				value: "tests/billing.test.ts",
				label: "billing.test.ts",
				icon: fileIcon,
			},
		],
	},
	{
		value: "scripts",
		label: "scripts",
		icon: folderIcon,
		children: [
			{ value: "scripts/seed.ts", label: "seed.ts", icon: fileIcon },
			{ value: "scripts/build.ts", label: "build.ts", icon: fileIcon },
		],
	},
];

/**
 * Deep search. Typing searches every level instead of only the current one,
 * and each result carries its folder path - without that, three files named
 * `page.tsx` would be indistinguishable. Clear the query to return to browsing.
 */
export function Cascader3Example(): React.JSX.Element {
	const [value, setValue] = useState("");

	return (
		<div className="flex w-full flex-col items-center gap-3 p-4">
			<Cascader items={tree} value={value} onValueChange={setValue} searchScope="deep">
				<CascaderTrigger aria-label="File" render={<Button variant="outline" className="w-72 justify-between gap-2 font-normal" />}>
					<CascaderValue placeholder="Find a file" maxSegments={TRIGGER_MAX_SEGMENTS} />
				</CascaderTrigger>

				<CascaderContent className="w-80">
					<CascaderPanel>
						<CascaderNav>
							<CascaderInput placeholder="Search all files..." />
						</CascaderNav>
						<CascaderBreadcrumb />
						<CascaderEmpty />
						<CascaderList>
							<CascaderItems />
						</CascaderList>
						<CascaderStatus />
					</CascaderPanel>
				</CascaderContent>
			</Cascader>
		</div>
	);
}
