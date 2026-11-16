import Link from "next/link";
import * as React from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";

export function Empty2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Empty className="bg-muted">
				<EmptyHeader>
					<EmptyTitle>No results found</EmptyTitle>
					<EmptyDescription>No results found for your search. Try adjusting your search terms.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button>Try again</Button>
					<Button variant="link" render={<Link href="#component-empty" />} className="text-muted-foreground" nativeButton={false}>
						Learn more <ArrowUpRightIcon />
					</Button>
				</EmptyContent>
			</Empty>
		</div>
	);
}
