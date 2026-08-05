import { Module } from "@nestjs/common";

import { RbacService } from "./rbac.service.js";

@Module({
	providers: [RbacService],
	exports: [RbacService],
})
export class RbacModule {}
