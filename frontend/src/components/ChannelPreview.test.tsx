import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../i18n/I18nContext";
import { ChannelPreview } from "./ChannelPreview";

describe("ChannelPreview", () => {
  it("replaces a long public URL with a compact action", () => {
    const url = "http://127.0.0.1:15173/offer/a-very-long-token-that-should-not-overflow";
    render(
      <I18nProvider>
        <ChannelPreview channel="whatsapp" message={`Confirm here: ${url}. If not, your booking stays unchanged.`} actionUrl={url} />
      </I18nProvider>,
    );

    const action = screen.getByRole("link", { name: /appointment offer|предложение|пропозицію/i });
    expect(action.getAttribute("href")).toBe(url);
    expect(screen.queryByText(url)).toBeNull();
    expect(screen.getByText(/booking stays unchanged/i)).toBeTruthy();
  });
});
