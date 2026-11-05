import { Global, Module } from "@nestjs/common";

import { PersonalDataErasureRegistry } from "../../application/personal-data/personal-data-erasure.registry";
import { PersonalDataExportRegistry } from "../../application/personal-data/personal-data-export.registry";

/** The registries every context registers its exporter, eraser and erasure blockers into (ADR 077). */
@Global()
@Module({
	providers: [PersonalDataExportRegistry, PersonalDataErasureRegistry],
	exports: [PersonalDataExportRegistry, PersonalDataErasureRegistry],
})
export class PersonalDataModule {}
