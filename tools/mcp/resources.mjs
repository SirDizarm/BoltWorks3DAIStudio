import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(THIS_DIR, "..", "..");
const HANDBOOK_ROOT = resolve(REPO_ROOT, "BoltWorksStudioAi");
const DOCS_ROOT = resolve(REPO_ROOT, "docs");
const RESOURCE_LIMIT = 5 * 1024 * 1024;

function isContained(root, target) {
  const pathFromRoot = relative(root, target);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== ".." && !pathFromRoot.startsWith(sep));
}

async function readContainedText(root, relativePath) {
  const lexicalRoot = resolve(root);
  const lexicalTarget = resolve(lexicalRoot, relativePath);
  if (!isContained(lexicalRoot, lexicalTarget)) {
    throw new Error("Knowledge resource path escaped its approved root.");
  }

  const [actualRoot, targetStat] = await Promise.all([realpath(lexicalRoot), lstat(lexicalTarget)]);
  if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
    throw new Error("Knowledge resources must be regular, non-symbolic-link files.");
  }
  if (targetStat.size > RESOURCE_LIMIT) {
    throw new Error("Knowledge resource exceeds the MCP size limit.");
  }

  const actualTarget = await realpath(lexicalTarget);
  if (!isContained(actualRoot, actualTarget)) {
    throw new Error("Resolved knowledge resource path escaped its approved root.");
  }
  return readFile(actualTarget, "utf8");
}

function mimeTypeFor(path) {
  return extname(path).toLowerCase() === ".json" || extname(path).toLowerCase() === ".modelerproj"
    ? "application/json"
    : "text/markdown";
}

function handbookSlug(fileName) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function registerFileResource(server, definition) {
  server.registerResource(
    definition.name,
    definition.uri,
    {
      title: definition.title,
      description: definition.description,
      mimeType: mimeTypeFor(definition.path)
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: mimeTypeFor(definition.path),
          text: await readContainedText(definition.root, definition.path)
        }
      ]
    })
  );
}

export async function registerKnowledgeResources(server) {
  const manifestText = await readContainedText(HANDBOOK_ROOT, "manifest.json");
  const manifest = JSON.parse(manifestText);
  const readingOrder = Array.isArray(manifest.readingOrder) ? manifest.readingOrder : [];

  const definitions = [
    {
      name: "boltworks-handbook-manifest",
      uri: "boltworks://handbook/manifest",
      title: "BoltWorks AI handbook manifest",
      description: "Machine-readable entry point and reading order for BoltWorks authoring knowledge.",
      root: HANDBOOK_ROOT,
      path: "manifest.json"
    },
    {
      name: "boltworks-handbook-readme",
      uri: "boltworks://handbook/readme",
      title: "BoltWorks AI authoring handbook",
      description: "Human and AI entry point for creating editable BoltWorks projects.",
      root: HANDBOOK_ROOT,
      path: "README.md"
    },
    ...readingOrder.map((path) => ({
      name: `boltworks-handbook-${handbookSlug(path)}`,
      uri: `boltworks://handbook/${handbookSlug(path)}`,
      title: `BoltWorks handbook: ${path.replace(/\.md$/i, "").replace(/_/g, " ")}`,
      description: `Reading-order handbook document ${path}.`,
      root: HANDBOOK_ROOT,
      path
    })),
    {
      name: "boltworks-project-schema",
      uri: "boltworks://schema/modeler-project",
      title: "BoltWorks modeler project schema",
      description: "Canonical JSON Schema for editable .modelerproj files.",
      root: HANDBOOK_ROOT,
      path: "schemas/modeler-project.schema.json"
    },
    {
      name: "boltworks-work-session-schema",
      uri: "boltworks://schema/ai-work-session",
      title: "BoltWorks AI work-session schema",
      description: "Canonical JSON Schema for bounded, auditable .bws-session.json reports.",
      root: HANDBOOK_ROOT,
      path: "schemas/ai-work-session.schema.json"
    },
    {
      name: "boltworks-minimal-project",
      uri: "boltworks://example/minimal-project",
      title: "Minimal valid BoltWorks project",
      description: "Smallest canonical editable .modelerproj example.",
      root: HANDBOOK_ROOT,
      path: "examples/minimal-valid.modelerproj"
    },
    {
      name: "boltworks-medieval-house-library",
      uri: "boltworks://library/medieval-house",
      title: "Medieval house style library",
      description: "Construction, material, placement, and visual rules for the medieval house asset family.",
      root: HANDBOOK_ROOT,
      path: "libraries/medieval-house/README.md"
    },
    {
      name: "boltworks-mesh-test-codes",
      uri: "boltworks://docs/mesh-test-codes",
      title: "BoltWorks mesh test codes",
      description: "Compact shared codes for repeatable mesh QA and human/AI test reports.",
      root: DOCS_ROOT,
      path: "MESH_TEST_CODES.md"
    }
  ];

  for (const definition of definitions) registerFileResource(server, definition);
  return definitions.map(({ uri, title }) => ({ uri, title }));
}
