"use client";

// Where a server runs, as a mark: the cloud's own logo (Simple Icons, CC0) in its brand colour, or a
// laptop / generic server for machines that are not on a cloud we know.

import type { OpsServerProvider } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import { Laptop, Server } from "lucide-react";
import * as React from "react";
import { siAkamai, siDigitalocean, siHetzner, siVultr, type SimpleIcon } from "simple-icons";

/** How each provider reads. */
export const PROVIDER_LABELS: Readonly<Record<OpsServerProvider, string>> = {
	LOCAL: "This computer",
	DIGITALOCEAN: "DigitalOcean",
	LINODE: "Linode",
	VULTR: "Vultr",
	HETZNER: "Hetzner",
	OTHER: "Other",
};

/** The cloud logos; Linode is Akamai's cloud and carries Akamai's mark. */
const CLOUD_ICONS: Readonly<Record<Exclude<OpsServerProvider, "LOCAL" | "OTHER">, SimpleIcon>> = {
	DIGITALOCEAN: siDigitalocean,
	LINODE: siAkamai,
	VULTR: siVultr,
	HETZNER: siHetzner,
};

export function ProviderIcon({ provider, className }: { readonly provider: OpsServerProvider; readonly className?: string }): React.JSX.Element {
	switch (provider) {
		case "LOCAL":
			return <Laptop aria-hidden className={cn("size-4 shrink-0 text-muted-foreground", className)} />;
		case "OTHER":
			return <Server aria-hidden className={cn("size-4 shrink-0 text-muted-foreground", className)} />;
		default: {
			const icon: SimpleIcon = CLOUD_ICONS[provider];
			return (
				<svg aria-hidden role="img" viewBox="0 0 24 24" className={cn("size-4 shrink-0", className)} fill={`#${icon.hex}`}>
					<path d={icon.path} />
				</svg>
			);
		}
	}
}
