// @vitest-environment jsdom
import { MESSAGE_EXAMPLES } from "@/components/component-gallery/examples/message";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Message", MESSAGE_EXAMPLES);
