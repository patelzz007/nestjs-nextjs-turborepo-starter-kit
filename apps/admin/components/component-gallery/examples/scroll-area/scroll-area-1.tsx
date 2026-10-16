import * as React from "react";
import { ScrollArea } from "@workspace/ui/components/scroll-area";

/** How many beta releases the list shows, newest first. */
const RELEASE_COUNT = 30;
const tags: readonly string[] = Array.from({ length: RELEASE_COUNT }, (_: undefined, position: number): string => `v1.2.0-beta.${String(RELEASE_COUNT - position)}`);

export function ScrollArea1Example(): React.JSX.Element {
	return (
		<ScrollArea className="h-72 w-48 rounded-2xl border">
			<div className="p-4">
				<h4 className="mb-4 text-sm leading-none font-medium">Releases</h4>
				<div className="flex flex-col divide-y">
					{tags.map((tag: string): React.JSX.Element => (
						<div key={tag} className="py-2 text-sm">
							{tag}
						</div>
					))}
				</div>
			</div>
		</ScrollArea>
	);
}
