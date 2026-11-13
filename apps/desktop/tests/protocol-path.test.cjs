const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { resolveRendererRequestPath } = require("../dist/main/protocol-path.js");

let tempRoot;
let rendererRoot;

before(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kfp-protocol-test-"));
  rendererRoot = path.join(tempRoot, "renderer");
  await fs.mkdir(rendererRoot);
  await fs.writeFile(path.join(rendererRoot, "index.html"), "renderer page");
  await fs.writeFile(path.join(tempRoot, "outside.html"), "outside page");
});

after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test("resolves valid app requests to existing files in the renderer", async () => {
  assert.equal(
    await resolveRendererRequestPath("kingsfort://app/index.html", rendererRoot),
    path.join(rendererRoot, "index.html"),
  );
});

test("rejects encoded traversal after URL decoding", async () => {
  assert.equal(
    await resolveRendererRequestPath("kingsfort://app/%2e%2e%2foutside.html", rendererRoot),
    null,
  );
});

test("rejects invalid hosts, URL forms, and malformed encodings", async () => {
  for (const requestUrl of [
    "not a URL",
    "file:///index.html",
    "kingsfort://evil/index.html",
    "kingsfort://app:444/index.html",
    "kingsfort://user@app/index.html",
    "kingsfort://app/index.html?download=1",
    "kingsfort://app/index.html#fragment",
    "kingsfort://app/%E0%A4%A",
    "kingsfort://app/%5c..%5coutside.html",
    "kingsfort://app/%00index.html",
  ]) {
    assert.equal(await resolveRendererRequestPath(requestUrl, rendererRoot), null, requestUrl);
  }
});

test("rejects renderer symlinks that resolve outside the renderer", async (t) => {
  try {
    await fs.symlink(
      path.join(tempRoot, "outside.html"),
      path.join(rendererRoot, "outside-link.html"),
    );
  } catch (error) {
    if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error.code)) {
      t.skip("Windows symlink creation requires a privilege unavailable in this environment");
      return;
    }
    throw error;
  }
  assert.equal(
    await resolveRendererRequestPath("kingsfort://app/outside-link.html", rendererRoot),
    null,
  );
});
