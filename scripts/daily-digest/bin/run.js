#!/usr/bin/env node
import { loadConfig } from '../src/config.js';
import { runDigest } from '../src/digest.js';

async function main() {
  const config = loadConfig();
  const summary = await runDigest({ config });
  console.log('digest-sent', JSON.stringify(summary));
}

main().catch((err) => {
  console.error('digest-failed', err.message);
  process.exitCode = 1;
});
