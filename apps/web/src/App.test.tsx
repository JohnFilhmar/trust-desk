import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { App } from "@/App";

describe("App", () => {
  it("shows the product name as the page heading", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Trust Desk" }),
    ).toBeTruthy();
  });

  it("has no accessibility violations axe can detect", async () => {
    const { container } = render(<App />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
