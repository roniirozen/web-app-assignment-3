const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:net');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');

test('an occupied port exits with an error and never announces successful startup', async () => {
  const occupied = createServer().listen(0);
  await once(occupied, 'listening');
  try {
    const child = spawn(process.execPath, [path.join(__dirname, '../server.js')], {
      env: { ...process.env, PORT: String(occupied.address().port) },
      timeout: 10000
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const [code] = await once(child, 'close');
    assert.equal(code, 1);
    assert.match(stderr, /EADDRINUSE/);
    assert.doesNotMatch(stdout, /is running/);
  } finally {
    await new Promise(resolve => occupied.close(resolve));
  }
});
