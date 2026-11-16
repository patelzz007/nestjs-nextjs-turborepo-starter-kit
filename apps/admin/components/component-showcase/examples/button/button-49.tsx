import Link from "next/link";
import type * as React from "react";
import { ChevronLeftIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export function Button49Example(): React.JSX.Element {
	return (
		<Button variant="link" render={<Link href="#component-button" />} nativeButton={false}>
			<ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
			Go back
		</Button>
	);
}
