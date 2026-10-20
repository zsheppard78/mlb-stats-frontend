// Runs every *.test.js file in this folder and fails if any of them fail.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let failed = 0;
for (const file of files) {
    const started = Date.now();
    const run = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8' });
    const ok = run.status === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${file}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    if (!ok) console.log((run.stdout || '').split('\n').slice(-25).join('\n'), run.stderr);
}
console.log(`\n${files.length - failed}/${files.length} test files passed. Screenshots are in tests/screenshots/.`);
process.exit(failed ? 1 : 0);
