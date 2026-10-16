import { Button } from "@workspace/ui/components/button";
import type * as React from "react";

import { SHARE_TARGETS, type SignInMethod } from "@/components/component-gallery/examples/button/button-sign-in-methods";

export function Button36Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center gap-2">
			{SHARE_TARGETS.map(({ id, label, icon: Icon }: SignInMethod): React.JSX.Element => (
				<Button key={id} variant="outline" size="icon" aria-label={label}>
					<Icon aria-hidden="true" />
				</Button>
			))}
		</div>
	);
}
