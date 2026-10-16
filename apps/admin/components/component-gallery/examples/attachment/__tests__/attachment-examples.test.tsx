// @vitest-environment jsdom
import { ATTACHMENT_EXAMPLES } from "@/components/component-gallery/examples/attachment";
import { describeGalleryExamples } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";

describeGalleryExamples("Attachment", ATTACHMENT_EXAMPLES);
