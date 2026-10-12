import { HelloProfileSkeleton } from "@/components/loading/hello-profile-skeleton";
import * as React from "react";

/** `/hello` while the server fetches the profile. */
export default function HelloLoading(): React.JSX.Element {
	return <HelloProfileSkeleton />;
}
