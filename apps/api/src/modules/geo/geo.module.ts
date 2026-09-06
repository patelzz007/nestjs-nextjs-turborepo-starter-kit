import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { GeoController } from "./geo.controller";
import { GeoRepository } from "./repositories/geo.repository";
import { GeoService } from "./services/geo.service";

@Module({
	imports: [PrismaModule, AuthModule],
	controllers: [GeoController],
	providers: [GeoRepository, GeoService],
	exports: [GeoService],
})
export class GeoModule {}
