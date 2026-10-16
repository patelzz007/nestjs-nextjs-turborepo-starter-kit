import * as React from "react";
import { StarIcon } from "lucide-react";
import { Toggle } from "@workspace/ui/components/toggle";

export function Toggle8Example(): React.JSX.Element {
	return (
		<div className="flex flex-col items-center justify-center gap-4">
			<div className="flex items-center gap-3">
				<span className="w-16 text-sm text-muted-foreground">Small</span>
				<Toggle variant="outline" size="sm" aria-label="Toggle star small">
					<StarIcon />
				</Toggle>
			</div>
			<div className="flex items-center gap-3">
				<span className="w-16 text-sm text-muted-foreground">Default</span>
				<Toggle variant="outline" size="default" aria-label="Toggle star default">
					<StarIcon />
				</Toggle>
			</div>
			<div className="flex items-center gap-3">
				<span className="w-16 text-sm text-muted-foreground">Large</span>
				<Toggle variant="outline" size="lg" aria-label="Toggle star large">
					<StarIcon />
				</Toggle>
			</div>
		</div>
	);
}
