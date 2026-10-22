import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { storeImage } from "@/lib/images/process";
import { GET as fileRoute } from "@/app/api/images/[id]/file/route";
import { GET as imageDetail, PATCH as patchImage, DELETE as deleteImage } from "@/app/api/images/[id]/route";
import { GET as listImages } from "@/app/api/images/route";
import { GET as explore } from "@/app/api/explore/route";
import { POST as share, DELETE as revoke } from "@/app/api/images/[id]/share/route";
import { GET as shareFile } from "@/app/api/share/[token]/file/route";
import { POST as report } from "@/app/api/images/[id]/report/route";
import { POST as like } from "@/app/api/images/[id]/like/route";
import { call, makeUser, pngBuffer, resetDb } from "./helpers";

async function makeImage(userId: string, prompt = "a quiet harbour at dawn") {
  const stored = await storeImage(userId, await pngBuffer(80, 60));
  return db.generatedImage.create({ data: { userId, ...stored, prompt, origin: "GENERATED", style: "watercolor" } });
}

describe("image privacy, explore and sharing", () => {
  beforeEach(resetDb);

  it("images are private by default and their files are only served to the owner", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const img = await makeImage(owner.user.id);
    expect(img.visibility).toBe("PRIVATE");
    expect((await call(fileRoute, "/x", { params: { id: img.id } })).status).toBe(404);
    expect((await call(fileRoute, "/x", { session: stranger.session, params: { id: img.id } })).status).toBe(404);
    const mine = await call(fileRoute, "/x", { session: owner.session, params: { id: img.id } });
    expect(mine.status).toBe(200);
    expect(mine.headers.get("cache-control")).toContain("no-store");
    expect((await call(imageDetail, "/x", { session: stranger.session, params: { id: img.id } })).status).toBe(404);
    expect((await call(patchImage, "/x", { session: stranger.session, params: { id: img.id }, method: "PATCH", body: { visibility: "PUBLIC" } })).status).toBe(404);
    expect((await call(deleteImage, "/x", { session: stranger.session, params: { id: img.id }, method: "DELETE" })).status).toBe(404);
  });

  it("only explicitly public, non-moderated images appear in Explore – and can be made private again", async () => {
    const owner = await makeUser();
    const pub = await makeImage(owner.user.id, "public lighthouse");
    const priv = await makeImage(owner.user.id, "private lighthouse");
    const hidden = await makeImage(owner.user.id, "hidden lighthouse");
    await call(patchImage, "/x", { session: owner.session, params: { id: pub.id }, method: "PATCH", body: { visibility: "PUBLIC" } });
    await db.generatedImage.update({ where: { id: hidden.id }, data: { visibility: "PUBLIC", moderationStatus: "HIDDEN" } });
    const res = await call(explore, "/api/explore", { query: { q: "lighthouse", sort: "recent" } });
    expect(res.json.items.map((i: { id: string }) => i.id)).toEqual([pub.id]);
    expect(JSON.stringify(res.json)).not.toContain("storageKey");
    expect((await call(fileRoute, "/x", { params: { id: pub.id } })).status).toBe(200);
    expect((await call(fileRoute, "/x", { params: { id: priv.id } })).status).toBe(404);

    await call(patchImage, "/x", { session: owner.session, params: { id: pub.id }, method: "PATCH", body: { visibility: "PRIVATE" } });
    expect((await call(explore, "/api/explore", { query: { sort: "recent" } })).json.items).toHaveLength(0);
    expect((await call(fileRoute, "/x", { params: { id: pub.id } })).status).toBe(404);
  });

  it("respects creator choices to hide prompts and names", async () => {
    const owner = await makeUser();
    const img = await makeImage(owner.user.id, "secret sauce prompt");
    await call(patchImage, "/x", { session: owner.session, params: { id: img.id }, method: "PATCH", body: { visibility: "PUBLIC", showPrompt: false, showCreator: false } });
    const res = await call(explore, "/api/explore", { query: { sort: "recent" } });
    expect(res.json.items[0].prompt).toBeNull();
    expect(res.json.items[0].creator).toBeNull();
    // hidden prompts are not searchable either
    expect((await call(explore, "/api/explore", { query: { q: "secret sauce" } })).json.items).toHaveLength(0);
  });

  it("a user's library only ever contains their own images", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await makeImage(a.user.id);
    await makeImage(b.user.id);
    const res = await call(listImages, "/api/images", { session: a.session });
    expect(res.json.total).toBe(1);
  });

  it("share links use unguessable tokens, work for private images, and stop working when revoked", async () => {
    const owner = await makeUser();
    const img = await makeImage(owner.user.id);
    const created = await call(share, "/x", { session: owner.session, params: { id: img.id }, body: { showPrompt: true, showCreator: false } });
    const token: string = created.json.token;
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).not.toContain(img.id);
    expect((await call(shareFile, "/x", { params: { token } })).status).toBe(200);
    expect((await call(shareFile, "/x", { params: { token: token.slice(0, -2) + "zz" } })).status).toBe(404);
    // creating again returns the same active link
    expect((await call(share, "/x", { session: owner.session, params: { id: img.id }, body: {} })).json.token).toBe(token);
    await call(revoke, "/x", { session: owner.session, params: { id: img.id }, method: "DELETE" });
    expect((await call(shareFile, "/x", { params: { token } })).status).toBe(404);
  });

  it("deleting an image revokes share links and removes the file", async () => {
    const owner = await makeUser();
    const img = await makeImage(owner.user.id);
    const { json } = await call(share, "/x", { session: owner.session, params: { id: img.id }, body: {} });
    await call(deleteImage, "/x", { session: owner.session, params: { id: img.id }, method: "DELETE" });
    expect((await call(shareFile, "/x", { params: { token: json.token } })).status).toBe(404);
    expect((await call(fileRoute, "/x", { session: owner.session, params: { id: img.id } })).status).toBe(404);
  });

  it("reports auto-hide an image after the threshold, and likes are counted once per user", async () => {
    const owner = await makeUser();
    const img = await makeImage(owner.user.id);
    await call(patchImage, "/x", { session: owner.session, params: { id: img.id }, method: "PATCH", body: { visibility: "PUBLIC" } });
    const fan = await makeUser();
    await call(like, "/x", { session: fan.session, params: { id: img.id }, method: "POST" });
    const second = await call(like, "/x", { session: fan.session, params: { id: img.id }, method: "POST" });
    expect(second.json.likeCount).toBe(1);
    for (let i = 0; i < 3; i++) {
      const r = await makeUser();
      expect((await call(report, "/x", { session: r.session, params: { id: img.id }, body: { reason: "SPAM" } })).status).toBe(200);
    }
    expect((await db.generatedImage.findUniqueOrThrow({ where: { id: img.id } })).moderationStatus).toBe("HIDDEN");
    expect((await call(explore, "/api/explore", { query: { sort: "recent" } })).json.items).toHaveLength(0);
  });

  it("rejects non-image uploads by decoding the bytes", async () => {
    const u = await makeUser();
    await expect(storeImage(u.user.id, Buffer.from("<svg onload=alert(1)>"))).rejects.toThrow(/not a valid image/);
  });
});
