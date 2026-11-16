import * as React from "react";
import { CoverImage } from "@workspace/ui/components/cover-image";
import { ImageOffIcon } from "lucide-react";

const FALLBACK: React.ReactNode = (
	<div className="flex size-full flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
		<ImageOffIcon className="size-5" aria-hidden="true" />
		No cover yet
	</div>
);

export function CoverImageDo2Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<CoverImage src={null} alt="No cover yet" fallback={FALLBACK} className="rounded-lg" />
		</div>
	);
}
