import * as React from "react";
import { BookmarkIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";

export function Empty11Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center p-4">
			<Empty className="py-16">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<BookmarkIcon />
					</EmptyMedia>
					<EmptyTitle>No bookmarks</EmptyTitle>
					<EmptyDescription>Items you bookmark will be saved here for quick access.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button variant="outline" size="sm">
						Browse Items
					</Button>
				</EmptyContent>
			</Empty>
		</div>
	);
}
