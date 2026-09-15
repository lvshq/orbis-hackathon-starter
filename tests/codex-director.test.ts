import assert from "node:assert/strict";
import { test } from "node:test";
import {
  codexArguments,
  codexEnvironment,
  directorFailure,
  runCodexDirector,
} from "../lib/codex-director";

test("Codex child receives login location but none of the app's API keys", () => {
  const env = codexEnvironment({
    HOME: "/user",
    PATH: "/bin",
    NODE_ENV: "test",
    CODEX_HOME: "/user/.codex",
    OPENAI_API_KEY: "no",
    CODEX_API_KEY: "no",
    REACTOR_API_KEY: "no",
    GEMINI_API_KEY: "no",
    UNRELATED_SECRET: "no",
  });
  assert.equal(env.HOME, "/user");
  assert.equal(env.CODEX_HOME, "/user/.codex");
  for (const key of [
    "OPENAI_API_KEY",
    "CODEX_API_KEY",
    "REACTOR_API_KEY",
    "GEMINI_API_KEY",
    "UNRELATED_SECRET",
  ])
    assert.equal(key in env, false);
});
test("director uses ephemeral structured vision with shell and app tools disabled", () => {
  const args = codexArguments("/tmp/story", [
    "/tmp/story/image-1.jpg",
    "/tmp/story/image-2.jpg",
  ]);
  assert.ok(args.includes("--ephemeral"));
  assert.ok(args.includes("read-only"));
  assert.ok(args.includes("--ignore-user-config"));
  assert.equal(args.filter((x) => x === "--image").length, 2);
  assert.ok(args.includes("--output-schema"));
  assert.ok(args.includes("shell_tool"));
  assert.ok(args.includes("apps"));
  assert.equal(args.at(-1), "-");
  assert.ok(!args.includes("--dangerously-bypass-approvals-and-sandbox"));
});
test("director errors are actionable and never return raw provider details", () => {
  assert.equal(
    directorFailure("HTTP 429 quota secret-in-provider-body").status,
    429,
  );
  assert.ok(
    !directorFailure("HTTP 429 quota secret-in-provider-body").message.includes(
      "secret-in-provider-body",
    ),
  );
  assert.equal(directorFailure("401 unauthorized").status, 401);
  assert.equal(directorFailure("spawn ENOENT").status, 503);
  assert.equal(directorFailure("Operation not permitted").status, 503);
});
test("cancelled requests do not launch Codex and release the shared director slot", async () => {
  const signal = AbortSignal.abort();
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      runCodexDirector({ type: "object" }, "Test", [], signal),
      /cancelled/,
    );
});
