import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import type * as React from "react";

import { SIGN_IN_METHODS, type SignInMethod } from "@/components/component-gallery/examples/button/button-sign-in-methods";

export function Button60Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap gap-2">
			{SIGN_IN_METHODS.map(({ id, label, icon: Icon, toneClassName }: SignInMethod): React.JSX.Element => (
				<Button key={id} aria-label={`Login with ${label}`} className="flex-1" size="icon" variant="outline">
					<Icon aria-hidden="true" className={cn("size-4", toneClassName)} />
				</Button>
			))}
		</div>
	);
}
