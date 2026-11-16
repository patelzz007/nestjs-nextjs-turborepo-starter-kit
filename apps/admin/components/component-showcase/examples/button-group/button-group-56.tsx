import * as React from "react";
import { DownloadIcon, PaperclipIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

const attachment = {
	name: "Q4-Product-Roadmap.pdf",
	size: "2.4 MB",
};

export function ButtonGroup56Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			<Button variant="outline" size="xs">
				<PaperclipIcon aria-hidden="true" />
				{attachment.name}
				<span className="opacity-60">({attachment.size})</span>
			</Button>
			<Button variant="outline" size="icon-xs" aria-label="Download attachment">
				<DownloadIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
