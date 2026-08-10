import fs from "node:fs";
import vm from "node:vm";
import { parse } from "yaml";

const root = new URL("../", import.meta.url);
const path = (file) => new URL(file, root);
const writeJson = process.argv.includes("--write-json");
const VERSION = "1.7";
const LICENSE = "CC BY 4.0";
const SOURCE = "https://kishormorol.github.io/SkillsAllYouNeed/";
const CURRENT_RELEASE_IDS = [
  "pp-comet", "pp-comet-assistant",
  "mc-studio-agents", "mc-studio-skills", "mc-agent-flows",
  "cur-agent-mode", "cur-plan-mode", "cur-rules", "cur-skills", "cur-mcp",
  "cur-cloud-agent", "cur-bugbot", "cur-cli",
  "kiro-specs", "kiro-task-execution", "kiro-steering", "kiro-hooks", "kiro-powers"
];

function read(file) {
  return fs.readFileSync(path(file), "utf8");
}

function fail(message) {
  throw new Error(message);
}

function loadData() {
  const source = read("data.js");
  const sandbox = {
    document: {
      createElement: () => ({}),
      head: { appendChild: () => {} }
    },
    localStorage: { getItem: () => "[]", setItem: () => {} },
    console
  };

  vm.runInNewContext(
    `${source}\n;globalThis.__corpus = { ECO, ECOSYSTEMS, SKILLS, HOWTO, MATRIX_ROWS, CATEGORIES, STATUSES, NEW_IDS };`,
    sandbox,
    { filename: "data.js" }
  );

  return sandbox.__corpus;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function requireMatch(content, pattern, message) {
  if (!pattern.test(content)) fail(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function issueField(id, expectedType) {
  const field = issueForm.body?.find((item) => item.id === id);
  if (!field) fail(`submit-capability.yml is missing ${id}`);
  if (field.type !== expectedType) fail(`submit-capability.yml ${id} must use type ${expectedType}`);
  if (!field.attributes?.label) fail(`submit-capability.yml ${id} is missing a label`);
  if (field.validations?.required !== true) {
    fail(`submit-capability.yml ${id} must set validations.required to true`);
  }
  return field;
}

function issueOptions(id) {
  const options = issueField(id, "dropdown").attributes?.options;
  if (!Array.isArray(options)) fail(`submit-capability.yml ${id} must define dropdown options under attributes`);
  return options;
}

const data = loadData();
const jsonPath = path("skills.json");
const skillsJson = JSON.parse(read("skills.json"));
const styles = read("styles.css");
const readme = read("README.md");
const index = read("index.html");
const manifest = JSON.parse(read("manifest.json"));
let sitemap = read("sitemap.xml");
const issueTemplate = read(".github/ISSUE_TEMPLATE/submit-capability.yml");
const issueForm = parse(issueTemplate);
parse(read(".github/workflows/validate-corpus.yml"));

for (const field of ["name", "description", "title"]) {
  if (typeof issueForm[field] !== "string" || !issueForm[field].trim()) {
    fail(`submit-capability.yml top-level ${field} must be a non-empty string`);
  }
}
if (!Array.isArray(issueForm.body)) fail("submit-capability.yml body must be an array");
if (!Array.isArray(issueForm.labels) || issueForm.labels.some((label) => typeof label !== "string")) {
  fail("submit-capability.yml labels must be an array of strings");
}

const issueIds = [];
const issueTypes = new Set(["markdown", "input", "textarea", "dropdown", "checkboxes", "upload"]);
for (const item of issueForm.body) {
  if (!item || typeof item !== "object") fail("submit-capability.yml body items must be objects");
  if (!issueTypes.has(item.type)) fail(`submit-capability.yml has unsupported item type: ${item.type}`);
  if (item.type === "markdown") {
    if (!item.attributes?.value) fail("submit-capability.yml markdown items require attributes.value");
    continue;
  }
  if (!item.attributes?.label) fail(`submit-capability.yml ${item.id || "field"} is missing a label`);
  if (["dropdown", "checkboxes"].includes(item.type) && !Array.isArray(item.attributes.options)) {
    fail(`submit-capability.yml ${item.id || "field"} must define options`);
  }
  if (item.type === "upload" && !item.id) continue;
  if (!item.id || !/^[A-Za-z0-9_-]+$/.test(item.id)) {
    fail("submit-capability.yml field IDs must use letters, numbers, hyphens, or underscores");
  }
  issueIds.push(item.id);
}
if (new Set(issueIds).size !== issueIds.length) fail("submit-capability.yml field IDs must be unique");

const ecosystemNames = Object.keys(data.ECO);
const skillIds = new Set();
const skillsWithHowto = data.SKILLS.map((skill) => ({
  ...skill,
  howto: skill.howto || data.HOWTO[skill.id]
}));

for (const skill of skillsWithHowto) {
  for (const field of ["id", "name", "ecosystem", "category", "status", "description", "trigger", "howto", "example", "source"]) {
    if (!skill[field]) fail(`${skill.id || skill.name || "unknown skill"} is missing ${field}`);
  }
  if (skillIds.has(skill.id)) fail(`duplicate skill id: ${skill.id}`);
  skillIds.add(skill.id);
  if (!data.ECO[skill.ecosystem]) fail(`${skill.id} uses unknown ecosystem: ${skill.ecosystem}`);
  if (!data.CATEGORIES.includes(skill.category)) fail(`${skill.id} uses unknown category: ${skill.category}`);
  if (!data.STATUSES.includes(skill.status)) fail(`${skill.id} uses unknown status: ${skill.status}`);
}

for (const id of Object.keys(data.HOWTO)) {
  if (!skillIds.has(id)) fail(`HOWTO references missing skill: ${id}`);
}

for (const [ecosystem, config] of Object.entries(data.ECO)) {
  if (!config.prefix) fail(`${ecosystem} is missing a CSS prefix`);
  if (!config.color) fail(`${ecosystem} is missing a color`);
  if (!config.glyph) fail(`${ecosystem} is missing a glyph`);
  if (!config.blurb) fail(`${ecosystem} is missing a blurb`);
  if (!styles.includes(`--eco-${config.prefix}:`)) fail(`styles.css missing --eco-${config.prefix}`);
}

for (const row of data.MATRIX_ROWS) {
  if (row.length !== ecosystemNames.length + 1) {
    fail(`matrix row "${row[0]}" has ${row.length - 1} cells; expected ${ecosystemNames.length}`);
  }
  for (const value of row.slice(1)) {
    if (!["y", "p", "n"].includes(value)) fail(`matrix row "${row[0]}" has invalid value: ${value}`);
  }
}

for (const id of data.NEW_IDS) {
  if (!skillIds.has(id)) fail(`NEW_IDS references missing skill: ${id}`);
}
const releaseIds = [...data.NEW_IDS];
if (releaseIds.length !== CURRENT_RELEASE_IDS.length || CURRENT_RELEASE_IDS.some((id) => !data.NEW_IDS.has(id))) {
  fail(`NEW_IDS must contain only the current v${VERSION} batch`);
}

for (const [field, type] of Object.entries({
  name: "input",
  ecosystem: "dropdown",
  category: "dropdown",
  status: "dropdown",
  description: "textarea",
  trigger: "input",
  howto: "textarea",
  example: "textarea",
  source: "input"
})) {
  issueField(field, type);
}

for (const [id, expected] of [["ecosystem", ecosystemNames], ["category", data.CATEGORIES], ["status", data.STATUSES]]) {
  const actual = issueOptions(id);
  if (!sameJson(actual, expected)) {
    fail(`submit-capability.yml ${id} options are stale: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

const generatedDate = writeJson ? new Date().toISOString().slice(0, 10) : skillsJson.generated;
if (!/^\d{4}-\d{2}-\d{2}$/.test(generatedDate)) fail("skills.json generated date must use YYYY-MM-DD");
const generatedTime = Date.parse(`${generatedDate}T00:00:00Z`);
if (!Number.isFinite(generatedTime) || new Date(generatedTime).toISOString().slice(0, 10) !== generatedDate) {
  fail("skills.json generated date must be a valid calendar date");
}
if (generatedDate > new Date().toISOString().slice(0, 10)) fail("skills.json generated date cannot be in the future");

const skillCount = skillsWithHowto.length;
const ecosystemCount = ecosystemNames.length;
const categoryCount = data.CATEGORIES.length;
const matrixCount = data.MATRIX_ROWS.length;
const ecosystemList = `${ecosystemNames.slice(0, -1).join(", ")}, and ${ecosystemNames.at(-1)}`;
const registryDescription = `The open registry of AI skills — ready-to-use skill definitions for ${ecosystemList}.`;
const escapedEcosystemList = escapeRegExp(ecosystemList);

const readmeDescription = `The open registry of AI skills — ready-to-use capability definitions for ${ecosystemList}.`;
requireMatch(readme, new RegExp(`^> ${escapeRegExp(readmeDescription)}$`, "m"), "README.md lead ecosystem list is stale");
const ecosystemSection = readme.match(/## Ecosystems covered[^\n]*\n([\s\S]*?)\n---/)?.[1];
const documentedEcosystems = [...(ecosystemSection || "").matchAll(/^\| \*\*(.+?)\*\* \|/gm)].map((match) => match[1]);
if (documentedEcosystems.length !== ecosystemCount || ecosystemNames.some((name) => !documentedEcosystems.includes(name))) {
  fail("README.md ecosystem table is stale");
}

for (const [name, pattern] of [
  ["skills badge", new RegExp(`badge/skills-${skillCount}-`)],
  ["ecosystems badge", new RegExp(`badge/ecosystems-${ecosystemCount}-`)],
  ["ecosystems heading", new RegExp(`## Ecosystems covered \\(${skillCount} skills\\)`) ],
  ["comparison summary", new RegExp(`${matrixCount}-row capability matrix`) ],
  ["category filter count", new RegExp(`category \\(${categoryCount} types\\)`) ],
  ["skill card count", new RegExp(`- ${skillCount} skill cards`) ],
  ["API corpus count", new RegExp(`machine-readable corpus of all ${skillCount} skills`) ],
  ["API introduction count", new RegExp(`All ${skillCount} skills are available`) ],
  ["JSON example count", new RegExp(`"count": ${skillCount}`) ],
  ["matrix dimensions", new RegExp(`${matrixCount} capability rows × ${ecosystemCount} ecosystems`) ],
  ["JSON example ecosystems", new RegExp(`"ecosystems": \\[${ecosystemNames.map((name) => `"${name}"`).join(", ")}\\]`) ]
]) {
  requireMatch(readme, pattern, `README.md ${name} is stale`);
}

for (const id of ["count", "total-count"]) {
  requireMatch(index, new RegExp(`<b\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>\\s*${skillCount}\\s*</b>`), `index.html ${id} is stale; expected ${skillCount}`);
}

for (const [name, pattern] of [
  ["SEO description", new RegExp(`<meta\\b(?=[^>]*\\bname=["']description["'])(?=[^>]*\\bcontent=["'][^"']*${skillCount} ready-to-use[^"']*${escapedEcosystemList})[^>]*>`)],
  ["Open Graph description", new RegExp(`<meta\\b(?=[^>]*\\bproperty=["']og:description["'])(?=[^>]*\\bcontent=["'][^"']*${skillCount} ready-to-use[^"']*${escapedEcosystemList})[^>]*>`)],
  ["Twitter description", new RegExp(`<meta\\b(?=[^>]*\\bname=["']twitter:description["'])(?=[^>]*\\bcontent=["'][^"']*${skillCount} ready-to-use[^"']*${escapedEcosystemList})[^>]*>`)],
  ["JSON-LD description", new RegExp(`"description": ${escapeRegExp(JSON.stringify(registryDescription))}`)],
  ["hero description", new RegExp(`<p\\s+class=["']hero-sub["']>\\s*${escapeRegExp(registryDescription)}`)],
  ["onboarding ecosystem list", new RegExp(`Browse skills across ${escapedEcosystemList}`)],
  ["hero ecosystem count", new RegExp(`<b>\\s*${ecosystemCount}\\s*</b>\\s*<span>ecosystems</span>`)],
  ["hero category count", new RegExp(`<b>\\s*${categoryCount}\\s*</b>\\s*<span>categories</span>`)],
  ["catalog dimensions", new RegExp(`<section\\b(?=[^>]*\\bid=["']catalog-section["'])[^>]*>[\\s\\S]*?${ecosystemCount} ecosystems · ${categoryCount} categories[\\s\\S]*?<div\\s+class=["']filters["']\\s+id=["']filters-section["']`)],
  ["matrix capability count", new RegExp(`<[^>]+\\bid=["']matrix-count["'][^>]*>\\s*${matrixCount}\\s*<`)],
  ["matrix ecosystem count", new RegExp(`<[^>]+\\bid=["']matrix-ecosystem-count["'][^>]*>\\s*${ecosystemCount}\\s*<`)],
  ["footer dimensions", new RegExp(`skills · ${ecosystemCount} ecosystems · ${categoryCount} categories`)]
]) {
  requireMatch(index, pattern, `index.html ${name} is stale`);
}

const ecosystemSelect = index.match(/<select\s+id=["']f-ecosystem["'][^>]*>([\s\S]*?)<\/select>/)?.[1];
const ecosystemOptions = [...(ecosystemSelect || "").matchAll(/<option(?:\s+[^>]*)?>([^<]+)<\/option>/g)]
  .map((match) => match[1].trim())
  .filter((value) => value && value !== "— select —");
if (!sameJson(ecosystemOptions, ecosystemNames)) fail("index.html add-skill ecosystem options are stale");

if (manifest.description !== registryDescription) fail("manifest.json description is stale");

if (writeJson) {
  sitemap = sitemap.replace(/<lastmod>[^<]+<\/lastmod>/g, `<lastmod>${generatedDate}</lastmod>`);
  fs.writeFileSync(path("sitemap.xml"), sitemap);
}

const sitemapDates = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1]);
if (!sitemapDates.length || sitemapDates.some((date) => date !== generatedDate)) {
  fail(`sitemap.xml lastmod dates must match skills.json generated date: ${generatedDate}`);
}

const expectedJson = {
  version: VERSION,
  generated: generatedDate,
  count: skillsWithHowto.length,
  ecosystems: ecosystemNames,
  description: `SkillsAllYouNeed — open registry of AI skills for ${ecosystemNames.slice(0, -1).join(", ")}, and ${ecosystemNames.at(-1)}.`,
  license: LICENSE,
  source: SOURCE,
  skills: skillsWithHowto
};

if (writeJson) {
  fs.writeFileSync(jsonPath, `${JSON.stringify(expectedJson, null, 2)}\n`);
  console.log(`wrote skills.json (${expectedJson.count} skills)`);
}

const currentJson = writeJson ? JSON.parse(read("skills.json")) : skillsJson;
const comparableExpectedJson = writeJson ? expectedJson : { ...expectedJson, generated: currentJson.generated };

if (!sameJson(currentJson, comparableExpectedJson)) {
  fail("skills.json is out of sync with data.js; run `node tools/validate-corpus.mjs --write-json`");
}

console.log(`corpus ok: ${skillsWithHowto.length} skills, ${ecosystemNames.length} ecosystems, ${data.MATRIX_ROWS.length} matrix rows`);
