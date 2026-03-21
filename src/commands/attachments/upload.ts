/**
 * commands/attachments/upload.ts — slock attachments upload
 *
 * Uploads an image file to a channel. Returns attachment metadata
 * including the ID for use with messages send --attachment.
 */

import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export function registerUploadCommand(parent: Command): void {
  parent
    .command("upload")
    .description("Upload an image file")
    .requiredOption(
      "--target <target>",
      "Channel target: #channel, dm:@peer"
    )
    .requiredOption("--file <path>", "Path to image file (JPEG, PNG, GIF, WebP, max 5MB)")
    .action(async (opts) => {
      let target;
      try {
        target = parseTarget(opts.target);
      } catch (err) {
        fail("INVALID_ARGS", err instanceof Error ? err.message : String(err));
      }

      // Validate file exists and is a supported type
      const filePath = path.resolve(opts.file);
      if (!fs.existsSync(filePath)) {
        fail("INVALID_ARGS", `File not found: ${filePath}`);
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext];
      if (!mimeType) {
        fail(
          "INVALID_ARGS",
          `Unsupported file type "${ext}". Supported: JPEG, PNG, GIF, WebP`
        );
      }

      const stat = fs.statSync(filePath);
      if (stat.size > 5 * 1024 * 1024) {
        fail("INVALID_ARGS", `File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max: 5MB`);
      }

      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      let channelId;
      try {
        channelId = await resolveTarget(client, target);
      } catch (err) {
        fail("NOT_FOUND", err instanceof Error ? err.message : String(err));
      }

      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);

      const result = await client.uploadFile(
        channelId,
        filePath,
        fileName,
        fileBuffer,
        mimeType
      );

      success(
        { attachments: result.attachments },
        (d) =>
          d.attachments
            .map((a) => `Uploaded: ${a.filename} (${a.id})`)
            .join("\n")
      );
    });
}
