"use client";

import { Button } from "@workspace/ui/components/button";
import { toast } from "@workspace/ui/components/toast";
import type * as React from "react";

// `timeout` sets the auto-dismiss delay (the countdown bar drains over it);
// `0` keeps the toast until it is closed.

const QUICK_TIMEOUT_MS = 2000;
const STANDARD_TIMEOUT_MS = 5000;
const EXTENDED_TIMEOUT_MS = 10000;
/** A `timeout` of 0 disables auto-dismiss. */
const PERSISTENT_TIMEOUT_MS = 0;

function showQuick(): void {
	toast.add({ title: "Quick notice", description: "Disappears in 2 seconds.", timeout: QUICK_TIMEOUT_MS });
}

function showStandard(): void {
	toast.add({ title: "Standard notice", description: "Disappears in 5 seconds.", timeout: STANDARD_TIMEOUT_MS });
}

function showExtended(): void {
	toast.add({ title: "Extended notice", description: "Stays for 10 seconds.", timeout: EXTENDED_TIMEOUT_MS });
}

function showPersistent(): void {
	toast.add({ title: "Persistent notice", description: "This toast stays until dismissed.", timeout: PERSISTENT_TIMEOUT_MS });
}

export function Sonner5Example(): React.JSX.Element {
	return (
		<div className="grid grid-cols-3 gap-2">
			<Button size="sm" variant="outline" className="w-full" onClick={showQuick}>
				2s Duration
			</Button>
			<Button size="sm" variant="outline" className="w-full" onClick={showStandard}>
				5s Duration
			</Button>
			<Button size="sm" variant="outline" className="w-full" onClick={showExtended}>
				10s Duration
			</Button>
			<Button size="sm" variant="outline" className="col-span-3 w-full" onClick={showPersistent}>
				Persistent
			</Button>
		</div>
	);
}
