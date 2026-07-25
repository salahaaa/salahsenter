#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "config", "release-package-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const failures = [];

function requireFile(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) failures.push(`Missing required release file: ${relativePath}`);
  return full;
}

for (const file of manifest.requiredDocumentation) requireFile(file);
for (const file of manifest.requiredEnvironmentTemplates) requireFile(file);
requireFile("package.json");
requireFile("package-lock.json");

const workflowsDirectory = path.join(root, ".github", "workflows");
const actualWorkflows = fs.existsSync(workflowsDirectory)
  ? fs.readdirSync(workflowsDirectory).filter((file) => file.endsWith(".yml") || file.endsWith(".yaml")).sort()
  : [];
const expectedWorkflows = manifest.requiredWorkflows.map((workflow) => workflow.file).sort();
const extras = actualWorkflows.filter((file) => !expectedWorkflows.includes(file));
const missing = expectedWorkflows.filter((file) => !actualWorkflows.includes(file));
if (extras.length) failures.push(`Workflow(s) missing from release manifest/catalog: ${extras.join(", ")}`);
if (missing.length) failures.push(`Workflow(s) missing from package: ${missing.join(", ")}`);

for (const workflow of manifest.requiredWorkflows) {
  const file = requireFile(path.join(".github", "workflows", workflow.file));
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  const name = content.match(/^name:\s*(.+)\s*$/m)?.[1]?.trim();
  if (name !== workflow.name) failures.push(`Workflow name mismatch in ${workflow.file}: expected "${workflow.name}", got "${name || "missing"}"`);
}

const catalogPath = path.join(root, "docs", "RELEASE_WORKFLOW_CATALOG_2026-07-23_AR.md");
const catalog = fs.existsSync(catalogPath) ? fs.readFileSync(catalogPath, "utf8") : "";
const marker = catalog.match(/<!-- release-workflows:start -->([\s\S]*?)<!-- release-workflows:end -->/);
if (!marker) {
  failures.push("Release workflow catalog markers are missing.");
} else {
  for (const workflow of manifest.requiredWorkflows) {
    if (!marker[1].includes(`\`${workflow.file}\``) || !marker[1].includes(`\`${workflow.name}\``)) {
      failures.push(`Workflow catalog does not document ${workflow.file} / ${workflow.name}`);
    }
  }
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
if (!readme.includes("docs/RELEASE_WORKFLOW_CATALOG_2026-07-23_AR.md")) failures.push("README must link to the official release workflow catalog.");
const deployment = fs.readFileSync(path.join(root, "DEPLOYMENT.md"), "utf8");
if (!deployment.includes("docs/UPGRADE_GUIDE_2026-07-23_AR.md")) failures.push("DEPLOYMENT.md must link to the Upgrade Guide.");

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
for (const script of ["release:verify:source", "release:verify", "check:client-boundaries", "release:package-verify", "update:channel:verify", "admin:bootstrap"]) {
  if (!packageJson.scripts?.[script]) failures.push(`Missing required npm script: ${script}`);
}
if (fs.readFileSync(path.join(root, ".nvmrc"), "utf8").trim() !== manifest.nodeVersion) failures.push(`.nvmrc must be ${manifest.nodeVersion}`);
if (!String(packageJson.engines?.node || "").includes("22.19")) failures.push("package.json engines.node must require Node 22.19 or newer within Node 22.");

const result = {
  ok: failures.length === 0,
  nodeVersion: manifest.nodeVersion,
  workflows: actualWorkflows,
  requiredDocumentation: manifest.requiredDocumentation,
  failures
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
