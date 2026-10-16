// @vitest-environment jsdom
import { DRAWER_EXAMPLES } from "@/components/component-gallery/examples/drawer";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Drawer", DRAWER_EXAMPLES);
