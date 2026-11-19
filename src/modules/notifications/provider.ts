export type NotificationClaim = { id: string; leaseToken: string };
export interface NotificationProvider {
  dispatch(job: NotificationClaim): Promise<string>;
}
export async function dispatchBatch(jobs: NotificationClaim[], provider: NotificationProvider) {
  const result = { checked: 0, delivered: 0, failed: 0 };
  for (const job of jobs) {
    result.checked++;
    try {
      const state = await provider.dispatch(job);
      if (state === "delivered") result.delivered++;
      else if (["failed", "retrying"].includes(state)) result.failed++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
