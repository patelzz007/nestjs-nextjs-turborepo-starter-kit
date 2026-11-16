import * as React from "react";
import { HeartIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup8Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline">
				<HeartIcon aria-hidden="true" />
				Like
			</Button>
			<Button variant="outline" className="w-12" render={<span />} nativeButton={false}>
				1.2K
			</Button>
		</ButtonGroup>
	);
}
