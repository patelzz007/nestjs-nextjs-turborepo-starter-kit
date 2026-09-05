import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CapabilityMenuQuerySchema, apiPath } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";

import { NavigationMenuService } from "../services/navigation-menu.service";

const MENU_HEADERS: Readonly<Record<"ADMIN" | "MERCHANT" | "PLATFORM", { readonly title: string; readonly subtitle: string }>> = {
	ADMIN: { title: "Acme Inc.", subtitle: "Admin Panel" },
	MERCHANT: { title: "Rewardly", subtitle: "Merchant Portal" },
	PLATFORM: { title: "Rewardly", subtitle: "My Rewards" },
};

@ApiTags("Navigation")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/navigation/menu"))
export class NavigationMenuController {
	public constructor(private readonly navigationMenu: NavigationMenuService) {}

	@Get()
	@ApiOperation({ summary: "Navigation menu tree for a scope (filtered client-side by capabilities)" })
	@ApiOkResponse({ description: "Menu tree with required capability slugs" })
	public getMenu(@Query(new ZodValidationPipe(CapabilityMenuQuerySchema)) query: { scope: "PLATFORM" | "MERCHANT" | "ADMIN" }) {
		return this.navigationMenu.getMenu(query.scope, MENU_HEADERS[query.scope]);
	}
}
