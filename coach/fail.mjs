#!/usr/bin/env node
/* Closes a job out when a step above save.mjs died. Without this a crashed run
   leaves the row saying "running" forever and the app spins.

   It reads work/claude.log only through the classifier, which matches it
   against a fixed list of signatures and returns one of a fixed list of
   phrases. No part of the log itself is ever printed or stored — "the job
   failed" with no reason is useless when the cause is an expired token, and
   echoing the log would put training data in a public Action log. */

import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { serviceClient, getJob, setJobStatus } from './lib/db.mjs';
import { classifyFailure } from './lib/classify.mjs';

function reason() {
  if (!existsSync('work/claude.log')) return 'the run did not reach the coach';
  try {
    return classifyFailure(readFileSync('work/claude.log', 'utf8'));
  } catch {
    return 'unclassified';
  }
}

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

    const why = reason();
    await setJobStatus(client, jobId, {
      status: 'failed',
      error: `the run did not finish: ${why}`,
      finished_at: new Date().toISOString(),
    });
    // The category is a constant from classify.mjs, never text from the log.
    console.log(`job ${jobId} failed: ${why}`);
    return 0;
  } catch {
    console.error(`job ${jobId} could not be closed out`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv[2]));
}
