import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const worktreeList = execFileSync("git", ["worktree", "list", "--porcelain"], {
  encoding: "utf8",
});
const worktrees = [...worktreeList.matchAll(/^worktree (.+)$/gm)].map((match) => match[1]);
const primary = worktrees[0];

if (!primary) throw new Error("Could not locate the primary Git worktree.");

const sharedEnv = join(primary, "apps", "web", ".env.local");
if (!existsSync(sharedEnv)) {
  throw new Error(`Create the ignored local environment file at ${sharedEnv} before starting the web app.`);
}

for (const worktree of worktrees.slice(1)) {
  const localEnv = join(worktree, "apps", "web", ".env.local");
  mkdirSync(dirname(localEnv), { recursive: true });

  try {
    const stat = lstatSync(localEnv);
    if (stat.isSymbolicLink()) {
      const link = readlinkSync(localEnv);
      const target = isAbsolute(link) ? link : resolve(dirname(localEnv), link);
      if (resolve(target) === resolve(sharedEnv)) continue;
    }
    console.warn(`Keeping existing environment file at ${localEnv}; check it against ${sharedEnv}.`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    symlinkSync(sharedEnv, localEnv, "file");
    console.log(`Linked ${localEnv} to the shared local environment file.`);
  }
}
