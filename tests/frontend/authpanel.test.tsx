/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { AuthPanel } from "@/components/AuthPanel";

describe("AuthPanel", () => {
  it("renders login/register UI", () => {
    render(<AuthPanel onToken={() => {}} />);
    expect(screen.getAllByText("Login").length).toBeGreaterThan(0);
    expect(screen.getByText("Register")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
  });
});
