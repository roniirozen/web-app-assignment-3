const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

function check(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(item.name)) continue;
    const path = join(directory, item.name);
    if (item.isDirectory()) check(path);
    else if (item.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status || 1);
    }
  }
}
check(join(__dirname, '..'));
console.log('All JavaScript files passed syntax checks.');
