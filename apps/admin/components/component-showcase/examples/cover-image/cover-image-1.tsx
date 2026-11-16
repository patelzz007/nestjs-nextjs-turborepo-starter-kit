import { ImageOff } from "lucide-react";
import type * as React from "react";
import { CoverImage } from "@workspace/ui/components/cover-image";

const COVER_URL = "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80";

const FALLBACK: React.ReactNode = (
	<div className="flex size-full flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
		<ImageOff className="size-5" aria-hidden="true" />
		No image
	</div>
);

export function CoverImage1Example(): React.JSX.Element {
	return (
		<div className="grid w-full gap-4 sm:grid-cols-2">
			<CoverImage src={COVER_URL} alt="Code on a laptop screen" className="rounded-lg" />
			<CoverImage src={null} alt="No cover" fallback={FALLBACK} className="rounded-lg" />
		</div>
	);
}
