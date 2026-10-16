import * as React from "react";
import { FolderIcon } from "lucide-react";
import { IconTile } from "@workspace/ui/components/icon-tile";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";

export function IconTile12Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Empty>
				<EmptyHeader>
					<EmptyMedia>
						<IconTile tone="brand" variant="frame" size="xl" aria-hidden="true">
							<FolderIcon />
						</IconTile>
					</EmptyMedia>
					<EmptyTitle>No files yet</EmptyTitle>
					<EmptyDescription>Upload a file to get started. Everything you add shows up here.</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}
