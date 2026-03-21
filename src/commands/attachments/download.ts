/**
 * commands/attachments/download.ts — slock attachments download
 *
 * Downloads an attachment by UUID and saves to disk.
 * The server may redirect to a presigned S3 URL or stream directly.
 */

import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { ensureValidToken } from "../../auth.js";
import { success, fail } from "../../output.js";

export function registerDownloadCommand(parent: Command): void {
  parent
    .command("download")
    .description("Download an attachment by ID")
    .requiredOption("--id <id>", "Attachment UUID")
    .option("--output <path>", "Output file path (defaults to current directory with original filename)")
    .action(async (opts) => {
      const auth = await ensureValidToken();

      const url = `${auth.serverUrl}/api/attachments/${opts.id}`;
      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            "X-Server-Id": auth.serverId,
          },
          redirect: "follow",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fail("NETWORK_ERROR", `Failed to download: ${msg}`);
      }

      if (!res.ok) {
        if (res.status === 404) {
          fail("NOT_FOUND", `Attachment "${opts.id}" not found`);
        }
        if (res.status === 403) {
          fail("FORBIDDEN", "No access to this attachment");
        }
        fail("GENERAL_ERROR", `Download failed: HTTP ${res.status}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      // Determine output path
      let outputPath: string;
      if (opts.output) {
        outputPath = path.resolve(opts.output);
      } else {
        // Try to extract filename from Content-Disposition header
        const disposition = res.headers.get("content-disposition");
        let filename = `attachment-${opts.id}`;
        if (disposition) {
          const match = disposition.match(/filename="?([^";\n]+)"?/);
          if (match) {
            filename = decodeURIComponent(match[1]);
          }
        }
        outputPath = path.resolve(filename);
      }

      fs.writeFileSync(outputPath, buffer);

      success(
        {
          id: opts.id,
          path: outputPath,
          sizeBytes: buffer.length,
          mimeType: res.headers.get("content-type") ?? "application/octet-stream",
        },
        (d) => `Saved to ${d.path} (${d.sizeBytes} bytes)`
      );
    });
}
