import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StagingBanner } from "@/components/layout/StagingBanner";
import { STAGING_BANNER_TEXT } from "@/constants/messages";

describe("StagingBanner", () => {
  it("shows the test-site notice on staging", () => {
    render(<StagingBanner appEnv="staging" />);
    expect(screen.getByRole("status")).toHaveTextContent(STAGING_BANNER_TEXT);
  });

  it.each(["production", "development", undefined])("renders nothing when APP_ENV is %s", (env) => {
    const { container } = render(<StagingBanner appEnv={env} />);
    expect(container).toBeEmptyDOMElement();
  });
});
