import { CapabilityMenuResponseSchema, type CapabilityMenuResponse } from "@workspace/shared";

import { compileMenu } from "../sidebar/sidebar-menu-compile";
import type { CompiledSidebarMenuData } from "../sidebar/sidebar-menu-schema";
import { capabilityMenuResponseToSidebarData } from "./capability-menu-mapper";

/** Compiles a navigation API payload into a sidebar menu snapshot. */
export function compileCapabilityMenuResponse(response: CapabilityMenuResponse): CompiledSidebarMenuData | undefined {
	const parsed = CapabilityMenuResponseSchema.safeParse(response);
	if (!parsed.success) {
		return undefined;
	}
	return compileMenu(capabilityMenuResponseToSidebarData(parsed.data));
}
