/**
 * commands/tasks/resolve.ts — shared task number → ID resolution
 */

import type { ApiClient } from "../../client.js";
import { fail } from "../../output.js";

/**
 * Resolve task numbers to task UUIDs by listing all tasks in the channel.
 * Returns a Map<taskNumber, taskId>.
 */
export async function resolveTaskIds(
  client: ApiClient,
  channelId: string,
  numbers: number[]
): Promise<Map<number, string>> {
  const result = await client.listTasks(channelId);
  const taskMap = new Map<number, string>();

  for (const task of result.tasks) {
    if (numbers.includes(task.taskNumber)) {
      taskMap.set(task.taskNumber, task.id);
    }
  }

  const missing = numbers.filter((n) => !taskMap.has(n));
  if (missing.length > 0) {
    fail(
      "NOT_FOUND",
      `Task(s) not found: ${missing.map((n) => `#t${n}`).join(", ")}`
    );
  }

  return taskMap;
}
