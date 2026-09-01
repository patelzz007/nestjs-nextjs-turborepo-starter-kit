import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { GeoController } from "./geo.controller";
import { GeoService } from "./services/geo.service";

@Module({
	imports: [AuthModule],
	controllers: [GeoController],
	providers: [GeoService],
	exports: [GeoService],
})
export class GeoModule {}
