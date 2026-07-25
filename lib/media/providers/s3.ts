import crypto from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { MediaProvider, UploadInput, UploadedMedia } from "../types";
import { safeFileName } from "../guards";

/**
 * S3 / Cloudflare R2 provider — any S3-compatible object storage.
 * `provider` param ("s3" | "r2") only toggles path-style addressing for R2.
 */
export function createS3Provider(provider: "s3" | "r2"): MediaProvider {
  return {
    name: provider,
    async upload(input: UploadInput): Promise<UploadedMedia> {
      const bucket = process.env.S3_BUCKET;
      const accessKeyId = process.env.S3_ACCESS_KEY_ID;
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
      const endpoint = process.env.S3_ENDPOINT;
      const region = process.env.S3_REGION || "auto";
      const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
      if (!bucket || !accessKeyId || !secretAccessKey) throw new Error("إعدادات S3/R2 غير مكتملة");

      const client = new S3Client({
        region,
        endpoint: endpoint || undefined,
        forcePathStyle: Boolean(endpoint && provider !== "r2"),
        credentials: { accessKeyId, secretAccessKey }
      });
      const name = safeFileName(input.fileName);
      const storageKey = `${input.folder}/${name}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: input.buffer,
          ContentType: input.mimeType,
          Metadata: { originalNameSha256: crypto.createHash("sha256").update(input.fileName).digest("hex") }
        })
      );

      const url = publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, "")}/${storageKey}` : `https://${bucket}.s3.${region}.amazonaws.com/${storageKey}`;
      return { provider, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url, storageKey };
    }
  };
}
