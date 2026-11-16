import * as React from "react";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, MenuIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup12Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline" size="icon-sm" aria-label="Align left">
				<AlignLeftIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon-sm" aria-label="Align center">
				<AlignCenterIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon-sm" aria-label="Align right">
				<AlignRightIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon-sm" aria-label="Align justify">
				<MenuIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
