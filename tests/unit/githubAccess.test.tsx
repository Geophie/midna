import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppShell } from "@/components/AppShell";
import { HelpTab } from "@/components/tabs/HelpTab";
import { STRINGS } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

const GITHUB_URL = "https://github.com/Geophie/midna";

afterEach(() => {
  cleanup();
  useAppStore.setState({ lang: "en" });
});

function expectGithubLink(link: HTMLAnchorElement) {
  expect(link.href).toBe(GITHUB_URL);
  expect(link.target).toBe("_blank");
  expect(link.rel).toBe("noopener noreferrer");
}

describe("GitHub access", () => {
  it("renders the localized secondary header link with safe new-tab attributes", () => {
    render(
      <AppShell
        tabs={[{ id: "input", label: "Input" }]}
        activeTab="input"
        onTabChange={() => {}}
        mapPanelVisible={false}
        onMapPanelVisibleChange={() => {}}
        mapPanel={<div>Map</div>}
      >
        <div>Content</div>
      </AppShell>,
    );
    expectGithubLink(screen.getByRole("link", { name: STRINGS.en.github_repository_aria }) as HTMLAnchorElement);
  });

  it.each(["en", "it"] as const)("renders the %s guide CTA", (lang) => {
    useAppStore.setState({ lang });
    render(<HelpTab />);
    expect(screen.getByText(STRINGS[lang].github_star_cta).isConnected).toBe(true);
    expectGithubLink(screen.getByRole("link", { name: STRINGS[lang].github_star_button }) as HTMLAnchorElement);
  });
});
