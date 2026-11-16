import * as React from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";

export function Button40Example(): React.JSX.Element {
	return (
		<Button variant="outline" aria-label="Search (Command K)">
			<SearchIcon aria-hidden="true" />
			<span>Search</span>
			<KbdGroup aria-hidden="true">
				<Kbd>⌘</Kbd>
				<Kbd>K</Kbd>
			</KbdGroup>
		</Button>
	);
}
