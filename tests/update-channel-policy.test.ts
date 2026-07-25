import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const updater = readFileSync("tools/Apply-Mall-Update.ps1", "utf8");
const initializer = readFileSync("tools/Initialize-Mall-Update-Channel.ps1", "utf8");
const manifest = JSON.parse(readFileSync("config/update-channel-manifest.json", "utf8"));

describe("one-command update channel", () => {
  it("verifies package integrity and preserves a rollback branch before replacing source", () => {
    expect(updater).toContain("Get-FileHash");
    expect(updater).toContain("CHECKSUM.txt");
    expect(updater).toContain("SHA-256 mismatch");
    expect(updater).toContain("backup/staging-before-update");
    expect(updater).toContain("Restore-BackupBranch");
    expect(updater).toContain("release:verify:source");
  });

  it("pushes only the staging branch after local verification and never runs database/deployment operations", () => {
    expect(updater).toContain('"origin", "staging"');
    expect(updater).not.toContain("db:migrate");
    expect(updater).not.toContain("db:push");
    expect(updater).not.toContain("db:seed");
    expect(updater).not.toContain("vercel --prod");
    expect(updater).not.toContain("git push --force");
  });

  it("handles a ZIP-extracted repository with no first commit before staging initialization", () => {
    expect(initializer).toContain("INITIALIZE_STAGING_UPDATE_CHANNEL");
    expect(initializer).toContain("$initializedHere = $true");
    expect(initializer).toContain("Test-LocalGitHasCommit");
    expect(initializer).toContain("ConvertTo-TrimmedText");
    expect(initializer).toContain("$hasOrigin");
    expect(initializer).toContain("git -C $ProjectRoot remote");
    expect(initializer).not.toContain("rev-parse --verify HEAD");
    expect(initializer).not.toContain("remote get-url origin 2>$null");
    expect(manifest.channel).toBe("staging");
    expect(manifest.sourceDirectories).toContain("tools");
    expect(manifest.sourceDirectories).toContain(".github");
    expect(manifest.excludedRootFiles).toContain(".env");
  });
});
