/**
 * The ONLY file other code may import from the operations context (ADR 068).
 *
 * - `OperationsModule` — mounted by `AppModule`.
 * - `RequestMetricsRecorder` — fed by the Fastify `onResponse` hook (bootstrap) with every answered
 *   request, so this instance can report its request rate, errors and latency.
 */
export { RequestMetricsRecorder } from "./infrastructure/instance/request-metrics.recorder";
export { OperationsModule } from "./operations.module";
