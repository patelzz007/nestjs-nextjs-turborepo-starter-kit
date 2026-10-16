// @vitest-environment jsdom
import { ALERT_EXAMPLES } from "@/components/component-gallery/examples/alert";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Alert", ALERT_EXAMPLES);
