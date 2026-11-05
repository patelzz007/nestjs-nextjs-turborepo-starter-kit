// The privacy context's public surface (ADR 077): its module. No other context imports privacy; contexts hand
// their personal data to it through the platform `PersonalDataExportRegistry`.
export { PrivacyModule } from "./privacy.module";
