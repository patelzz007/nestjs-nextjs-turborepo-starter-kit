import Link from "next/link";
import type * as React from "react";
import { Button } from "@workspace/ui/components/button";

export function Button27Example(): React.JSX.Element {
	return (
		<Button render={<Link href="/" />} nativeButton={false}>
			Back to Home
		</Button>
	);
}
