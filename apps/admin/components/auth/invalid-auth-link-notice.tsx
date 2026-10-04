import type * as React from "react";

export interface InvalidAuthLinkNoticeProps {
	readonly children: React.ReactNode;
}

/** Shown in place of a token form when the emailed link has no usable token. */
export function InvalidAuthLinkNotice({ children }: InvalidAuthLinkNoticeProps): React.JSX.Element {
	return (
		<div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
			{children}
		</div>
	);
}
