import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { parseEnhancerOutput } from "@/lib/ai/enhancer";
import { POST as enhance } from "@/app/api/prompts/enhance/route";
import { call, installFetch, makeUser, resetDb } from "./helpers";

describe("prompt enhancer", () => {
  beforeEach(resetDb);

  it("parses JSON, fenced JSON and plain-text LLM replies", () => {
    expect(parseEnhancerOutput('{"prompts":["first prompt here","second prompt"]}', 2)).toEqual(["first prompt here", "second prompt"]);
    expect(parseEnhancerOutput('{"prompts":["one","two","three"]}', 1)).toEqual(["one"]);
    expect(parseEnhancerOutput('Sure!\n```json\n{"prompts":["A fluffy orange cat floating in space"]}\n```', 1)).toEqual(["A fluffy orange cat floating in space"]);
    expect(parseEnhancerOutput("A detailed cinematic scene of a cat in space", 1)).toEqual(["A detailed cinematic scene of a cat in space"]);
    expect(() => parseEnhancerOutput("{}", 1)).toThrow();
  });

  it("calls the configured LLM, returns alternatives and stores original + enhanced prompts", async () => {
    const calls = installFetch({
      "http://llm.test": async (_url, init) => {
        const body = JSON.parse(String(init.body));
        expect(body.messages[0].content).toContain("exactly 2");
        return Response.json({ choices: [{ message: { content: JSON.stringify({ prompts: ["A highly detailed cat in a spacecraft, volumetric light", "A cinematic orange cat among nebulae"] }) } }] });
      },
    });
    const { session, user } = await makeUser();
    const res = await call(enhance, "/api/prompts/enhance", { session, body: { prompt: "A cat in space", mode: "cinematic", count: 2 } });
    expect(res.status).toBe(200);
    expect(res.json.prompts).toHaveLength(2);
    expect(calls[0].init.headers).toMatchObject({ Authorization: "Bearer test-llm" });
    const stored = await db.promptEnhancement.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.original).toBe("A cat in space");
    expect(stored.results).toHaveLength(2);
    expect(stored.mode).toBe("cinematic");
  });

  it("reports an error instead of pretending when the LLM is unavailable", async () => {
    installFetch({ "http://llm.test": () => new Response("upstream down", { status: 502 }) });
    const { session, user } = await makeUser();
    const res = await call(enhance, "/api/prompts/enhance", { session, body: { prompt: "A cat in space" } });
    expect(res.status).toBe(503);
    expect(res.json.error.message).toMatch(/not been changed/);
    expect(await db.promptEnhancement.count({ where: { userId: user.id } })).toBe(0);
  });

  it("requires authentication", async () => {
    expect((await call(enhance, "/api/prompts/enhance", { body: { prompt: "A cat" } })).status).toBe(401);
  });
});
