import { realpath } from "node:fs/promises";
import path from "node:path";

function isWithinDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

/** Resolve a well-formed kingsfort://app request within the renderer directory. */
export async function resolveRendererRequestPath(requestUrl: string, rendererRoot: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "kingsfort:" || url.hostname !== "app" || url.username !== "" || url.password !== "" || url.port !== "" || url.search !== "" || url.hash !== "") {
    return null;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  if (!decodedPath.startsWith("/") || decodedPath.includes(String.fromCharCode(92)) || decodedPath.includes(String.fromCharCode(0)) || decodedPath.split("/").some((segment) => segment === "..")) {
    return null;
  }

  const root = path.resolve(rendererRoot);
  const candidate = path.resolve(root, "." + decodedPath);
  if (!isWithinDirectory(root, candidate) || candidate === root) {
    return null;
  }

  try {
    const [realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
    if (!isWithinDirectory(realRoot, realCandidate) || realCandidate === realRoot) {
      return null;
    }
    return realCandidate;
  } catch {
    return null;
  }
}
