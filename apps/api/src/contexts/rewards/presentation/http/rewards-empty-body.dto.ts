import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/** POST bodies with no fields — approve, publish (Swagger only; the routes validate their params). */
export class RewardsEmptyBodyDto extends createZodDto(z.object({}).strict()) {}
