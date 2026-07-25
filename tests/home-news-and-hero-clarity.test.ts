import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/home/luxury-marketplace-home.tsx", "utf8");
const topNewsSource = source.slice(source.indexOf("function TopNewsBar"), source.indexOf("function LuxuryNavbar"));
const heroSource = source.slice(source.indexOf("function HeroSection"), source.indexOf("function FeaturedStores"));

describe("homepage news and hero clarity", () => {
  it("renders one visible news ticker and uses only one hidden clone for a seamless loop", () => {
    expect(source).not.toContain("HeroNewsTicker");
    expect(topNewsSource).toContain("min-w-[200%]");
    expect((topNewsSource.match(/aria-hidden=\"true\"/g) || [])).toHaveLength(1);
  });

  it("keeps the hero image clear and relies on a light readability overlay instead of an opaque black cover", () => {
    expect(heroSource).toContain("opacity-95");
    expect(heroSource).toContain("from-slate-950/48 via-slate-950/18 to-transparent");
    expect(heroSource).not.toContain("from-black via-black/65 to-black/20");
  });
});
