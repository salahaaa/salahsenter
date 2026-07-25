import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { MediaProvider, UploadInput, UploadedMedia } from "../types";
import { safeFileName } from "../guards";

/** Local filesystem provider — development only (writes to /public/uploads). */
export const localProvider: MediaProvider = {
  name: "local",
  async upload(input: UploadInput): Promise<UploadedMedia> {
    const name = safeFileName(input.fileName);
    const storageKey = `${input.folder}/${name}`;
    const dir = path.join(process.cwd(), "public", "uploads", input.folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), input.buffer);
    const baseUrl = process.env.LOCAL_UPLOAD_BASE_URL || "/uploads";
    return { provider: "local", fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: `${baseUrl}/${storageKey}`, storageKey };
  }
};
