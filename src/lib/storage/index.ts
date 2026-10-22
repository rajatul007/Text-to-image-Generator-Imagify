import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { del as blobDel, get as blobGet, put as blobPut } from "@vercel/blob";
import { env } from "../env";

export interface StorageDriver {
  readonly name: "local" | "s3" | "vercel-blob";
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Returns a Response streaming the object (local) or a short-lived redirect (s3). */
  serve(key: string, contentType: string, opts: { download?: string; cacheSeconds: number }): Promise<Response>;
}

const SAFE_KEY = /^[a-zA-Z0-9/_\-.]+$/;
function assertKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

class LocalStorage implements StorageDriver {
  readonly name = "local" as const;
  constructor(private root: string) {}
  private resolve(key: string) {
    assertKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, data: Buffer) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }
  async get(key: string) {
    return readFile(this.resolve(key));
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
  async serve(key: string, contentType: string, opts: { download?: string; cacheSeconds: number }) {
    const file = this.resolve(key);
    const info = await stat(file);
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": String(info.size),
      "Cache-Control": opts.cacheSeconds > 0 ? `private, max-age=${opts.cacheSeconds}` : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (opts.download) headers["Content-Disposition"] = `attachment; filename="${opts.download}"`;
    return new Response(stream, { headers });
  }
}

class S3Storage implements StorageDriver {
  readonly name = "s3" as const;
  private client: S3Client;
  constructor(private bucket: string) {
    const e = env();
    this.client = new S3Client({
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT || undefined,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: e.S3_ACCESS_KEY_ID!, secretAccessKey: e.S3_SECRET_ACCESS_KEY! },
    });
  }
  async put(key: string, data: Buffer, contentType: string) {
    assertKey(key);
    // Objects are private; access is only ever granted through short-lived presigned URLs.
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }));
  }
  async get(key: string) {
    assertKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  async delete(key: string) {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  async serve(key: string, contentType: string, opts: { download?: string; cacheSeconds: number }) {
    assertKey(key);
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: contentType,
        ResponseContentDisposition: opts.download ? `attachment; filename="${opts.download}"` : undefined,
      }),
      { expiresIn: 300 },
    );
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
  }
}

/**
 * Vercel Blob in PRIVATE mode. Blobs are not publicly reachable; bytes are streamed through our
 * access-controlled routes using the server-side BLOB_READ_WRITE_TOKEN.
 */
class VercelBlobStorage implements StorageDriver {
  readonly name = "vercel-blob" as const;
  async put(key: string, data: Buffer, contentType: string) {
    assertKey(key);
    await blobPut(key, data, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
  }
  private async fetch(key: string) {
    assertKey(key);
    const res = await blobGet(key, { access: "private" });
    if (!res || res.statusCode !== 200) throw new Error("Blob not found");
    return res;
  }
  async get(key: string) {
    const res = await this.fetch(key);
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  }
  async delete(key: string) {
    assertKey(key);
    await blobDel(key).catch(() => undefined);
  }
  async serve(key: string, contentType: string, opts: { download?: string; cacheSeconds: number }) {
    const res = await this.fetch(key);
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": opts.cacheSeconds > 0 ? `private, max-age=${opts.cacheSeconds}` : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (opts.download) headers["Content-Disposition"] = `attachment; filename="${opts.download}"`;
    return new Response(res.stream, { headers });
  }
}

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  if (e.STORAGE_DRIVER === "vercel-blob" || (e.STORAGE_DRIVER === "local" && process.env.VERCEL && process.env.BLOB_READ_WRITE_TOKEN)) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("STORAGE_DRIVER=vercel-blob but BLOB_READ_WRITE_TOKEN is missing – add a Blob store in Vercel → Storage");
    driver = new VercelBlobStorage();
  } else if (e.STORAGE_DRIVER === "s3") {
    if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) throw new Error("S3 storage selected but S3_BUCKET / credentials are missing");
    driver = new S3Storage(e.S3_BUCKET);
  } else {
    driver = new LocalStorage(path.resolve(e.LOCAL_STORAGE_DIR));
  }
  return driver;
}

export function setStorageDriverForTests(d: StorageDriver | null) {
  driver = d;
}
