import * as React from "react";

/** The merchant storefront mark used across the merchant auth pages. */
export function MerchantAuthLogo(): React.JSX.Element {
	return (
		<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
			<path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
		</svg>
	);
}
