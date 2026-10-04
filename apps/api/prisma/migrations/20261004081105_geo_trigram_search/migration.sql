-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "cities_name_trgm_idx" ON "cities" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "countries_name_trgm_idx" ON "countries" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "regions_name_trgm_idx" ON "regions" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "states_name_trgm_idx" ON "states" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "subregions_name_trgm_idx" ON "subregions" USING GIN ("name" gin_trgm_ops);
