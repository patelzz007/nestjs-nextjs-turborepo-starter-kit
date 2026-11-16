import * as React from "react";
import { CoverImage } from "@workspace/ui/components/cover-image";

const COVER_URL = "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80";

export function CoverImageDo1Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<CoverImage src={COVER_URL} alt="Code on a laptop screen" className="rounded-lg" />
		</div>
	);
}
