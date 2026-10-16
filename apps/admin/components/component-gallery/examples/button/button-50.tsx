import Link from "next/link";
import type * as React from "react";
import { ChevronLeftIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button50Example(): React.JSX.Element {
	return (
		<Button variant="link" className="group/back-button" render={<Link href="#component-button" />} nativeButton={false}>
			<ChevronLeftIcon data-icon="inline-start" aria-hidden="true" className="transition-transform duration-200 group-hover/back-button:-translate-x-1" />
			Go back
		</Button>
	);
}
