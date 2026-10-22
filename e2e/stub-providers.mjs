/**
 * TEST-ONLY HTTP stub that mimics the Stability AI and OpenAI-compatible chat APIs.
 * The application talks to it through its normal provider code by pointing STABILITY_API_BASE /
 * LLM_API_BASE at this server. It is never used by the application in development or production.
 *
 *   node e2e/stub-providers.mjs   (listens on STUB_PORT, default 4010)
 */
import http from "node:http";
import sharp from "sharp";

const PORT = Number(process.env.STUB_PORT ?? 4010);
const DIMS = { "1:1": [512, 512], "16:9": [768, 432], "9:16": [432, 768], "3:2": [720, 480], "2:3": [480, 720], "4:5": [512, 640], "5:4": [640, 512], "21:9": [840, 360], "9:21": [360, 840] };

async function png(seed, w, h, label = "") {
  const hue = seed % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${(hue + 120) % 360},70%,35%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="rgba(255,255,255,0.25)"/><text x="16" y="${h - 18}" font-family="sans-serif" font-size="18" fill="white">stub ${label} seed ${seed}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function readForm(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const r = new Request("http://stub" + req.url, { method: "POST", headers: req.headers, body });
  const ct = req.headers["content-type"] ?? "";
  if (ct.includes("multipart/form-data")) return { form: await r.formData() };
  return { json: body.length ? JSON.parse(body.toString()) : {} };
}

const stats = { stability: 0, llm: 0 };

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/__stats") return res.end(JSON.stringify(stats));
    if (req.method === "POST" && req.url.startsWith("/v2beta/stable-image/")) {
      stats.stability++;
      const { form } = await readForm(req);
      const prompt = String(form.get("prompt") ?? "");
      if (prompt.includes("FAILME")) {
        res.writeHead(500, { "content-type": "application/json" });
        return res.end(JSON.stringify({ errors: ["stub failure"] }));
      }
      if (prompt.includes("BLOCKME")) {
        res.writeHead(200, { "content-type": "image/png", "finish-reason": "CONTENT_FILTERED", seed: "1" });
        return res.end(await png(1, 64, 64));
      }
      if (prompt.includes("SLOWME")) await new Promise((r) => setTimeout(r, 4000));
      const seed = form.get("seed") ? Number(form.get("seed")) : Math.floor(Math.random() * 1e9);
      let [w, h] = DIMS[String(form.get("aspect_ratio") ?? "1:1")] ?? [512, 512];
      const image = form.get("image");
      if (image && typeof image !== "string") {
        const meta = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
        w = meta.width;
        h = meta.height;
        if (req.url.includes("upscale")) {
          w *= 2;
          h *= 2;
        }
      }
      const label = req.url.split("/").pop();
      res.writeHead(200, { "content-type": "image/png", seed: String(seed), "finish-reason": "SUCCESS" });
      return res.end(await png(seed, w, h, label));
    }
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      stats.llm++;
      const { json } = await readForm(req);
      const user = json.messages.find((m) => m.role === "user")?.content ?? "";
      const n = Number(/exactly (\d+)/.exec(json.messages[0].content)?.[1] ?? 1);
      const idea = user.replace(/^Idea:\s*/, "");
      const prompts = Array.from({ length: n }, (_, i) => `A highly detailed cinematic scene of ${idea}, dramatic volumetric lighting, rich colors, sharp focus, professional composition (variant ${i + 1})`);
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ prompts }) } }] }));
    }
    res.writeHead(404);
    res.end("not found");
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

server.listen(PORT, () => console.log(`stub providers listening on ${PORT}`));
