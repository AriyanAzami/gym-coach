/* A pipeline timeout, not a coaching number: the workflow itself is cut off at
   25 minutes, so anything still open well past that was lost. */
export const STALE_AFTER_MINUTES = 40;

/* Pure: the ids of jobs that are still queued or running but were created more
   than maxMinutes ago. Never includes the job named in exceptId. */
export function staleJobs(jobs, nowIso, maxMinutes, exceptId = null) {
  const cutoff = Date.parse(nowIso) - maxMinutes * 60_000;
  return jobs
    .filter((j) => j.id !== exceptId
      && (j.status === 'queued' || j.status === 'running')
      && Date.parse(j.created_at) < cutoff)
    .map((j) => j.id);
}
