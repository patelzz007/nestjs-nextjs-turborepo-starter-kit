// @vitest-environment jsdom
import { INPUT_OTP_EXAMPLES } from "@/components/component-gallery/examples/input-otp";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Input Otp", INPUT_OTP_EXAMPLES);
