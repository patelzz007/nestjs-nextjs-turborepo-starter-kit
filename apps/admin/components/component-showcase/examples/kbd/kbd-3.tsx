import * as React from "react";
import { ArrowLeftIcon, CircleDashedIcon } from "lucide-react";
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";

export function Kbd3Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<KbdGroup>
				<Kbd>
					<ArrowLeftIcon />
					Left
				</Kbd>
				<Kbd>
					<CircleDashedIcon />
					Voice Enabled
				</Kbd>
			</KbdGroup>
		</div>
	);
}
