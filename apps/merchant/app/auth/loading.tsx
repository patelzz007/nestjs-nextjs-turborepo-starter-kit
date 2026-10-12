import { MerchantAuthPageSkeleton } from "@/components/loading/auth-skeletons";
import type * as React from "react";

/** Every `/auth/*` page while its route loads: the auth layout's brand panel, title and form. */
export default function MerchantAuthLoading(): React.JSX.Element {
	return <MerchantAuthPageSkeleton />;
}
