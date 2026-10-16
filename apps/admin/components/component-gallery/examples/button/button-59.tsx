import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import type * as React from "react";

import { SIGN_IN_METHODS, type SignInMethod } from "@/components/component-gallery/examples/button/button-sign-in-methods";

export function Button59Example(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-2">
			{SIGN_IN_METHODS.map(({ id, label, icon: Icon, toneClassName }: SignInMethod): React.JSX.Element => (
				<Button key={id} variant="outline">
					<Icon data-icon="inline-start" aria-hidden="true" className={cn("size-4", toneClassName)} />
					<span className="text-muted-foreground">Login with</span> {label}
				</Button>
			))}
		</div>
	);
}
