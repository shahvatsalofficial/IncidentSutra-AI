import {spawnSync} from 'node:child_process';
const run = args => spawnSync(process.execPath, ['packages/cli/index.mjs', ...args], {stdio: 'inherit'});
let r = run(['analyze', '--input', 'fixtures/example-incident', '--out', 'examples/reports/demo', '--synthetic']);
if (r.status === 0) r = run(['verify', '--report', 'examples/reports/demo/incident-report.json', '--input', 'fixtures/example-incident']);
process.exitCode = r.status ?? 1;
