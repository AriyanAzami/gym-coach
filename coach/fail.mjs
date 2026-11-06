#!/usr/bin/env node
/* Closes a job out when a step above save.mjs died. Without this a crashed run
   leaves the row saying "running" forever and the app spins.

   It is deliberately incurious: it does not look at work/claude.log or at
   anything the model wrote, because whatever it reported would have to be
   printed or stored, and the log may contain training data. The row gets the
   step that failed, nothing more. */

import { pathToFileURL } from 'node:url';
import { serviceClient, getJob, setJobStatus } from './lib/db.mjs';

async function main(jobId) {
  if (!jobId) {
    console.error('usage: node coach/fail.mjs <job_id>');
    return 1;
  }

  try {
    const client = serviceClient();
    const job = await getJob(client, jobId);

    // save.mjs already wrote a reason; do not overwrite it with a vaguer one.
    if (job.status === 'done' || job.status === 'failed') {
      console.log(`job ${jobId} ${job.status}`);
      return 0;
    }

    await setJobStatus(client, jobId, {
      status: 'failed',
      error: 'the run did not finish; see the workflow run for which step failed',
      finished_at: new Date().toISOString(),
    });
    console.log(`job ${jobId} failed`);
    return 0;
  } catch {
    console.error(`job ${jobId} could not be closed out`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv[2]));
}
