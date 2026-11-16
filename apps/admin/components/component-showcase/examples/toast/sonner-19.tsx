"use client";

import { Button } from "@workspace/ui/components/button";
import { toast } from "@workspace/ui/components/toast";
import { BookmarkIcon, DownloadIcon, SendIcon } from "lucide-react";
import type * as React from "react";

// `data.icon` replaces the toast's type icon with any element.

const SEND_ICON = <SendIcon className="size-4" aria-hidden="true" />;
const DOWNLOAD_ICON = <DownloadIcon className="size-4" aria-hidden="true" />;
const BOOKMARK_ICON = <BookmarkIcon className="size-4" aria-hidden="true" />;

function showSent(): void {
	toast.add({ title: "Message sent", description: "Your message has been delivered.", data: { icon: SEND_ICON } });
}

function showDownloaded(): void {
	toast.add({ title: "Download complete", description: "design-assets.zip is ready.", data: { icon: DOWNLOAD_ICON } });
}

function showBookmarked(): void {
	toast.add({ title: "Bookmark added", description: "Saved to your collection.", data: { icon: BOOKMARK_ICON } });
}

export function Sonner19Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			<Button size="sm" variant="outline" className="w-fit" onClick={showSent}>
				Send Icon
			</Button>
			<Button size="sm" variant="outline" className="w-fit" onClick={showDownloaded}>
				Download Icon
			</Button>
			<Button size="sm" variant="outline" className="w-fit" onClick={showBookmarked}>
				Bookmark Icon
			</Button>
		</div>
	);
}
