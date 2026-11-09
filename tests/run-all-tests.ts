import { execSync } from 'child_process';

const testSuites = [
  { name: 'Private Media Security & Signed URLs', script: 'tests/private-media-security.test.ts' },
  { name: 'Image Upload Performance & Optimization', script: 'tests/image-upload-performance-verification.test.ts' },
  { name: 'QA Audit Suite', script: 'tests/qa-audit.test.ts' },
  { name: 'COD Enforcement & Pricing Security', script: 'tests/cod-security-verification.test.ts' },
  { name: 'Comprehensive Security & GST Suite', script: 'tests/comprehensive-security-and-gst.test.ts' },
  { name: '7 Storefront Sections Verification', script: 'tests/sections-verification.test.ts' },
  { name: 'P0/P1 Security & Persistence Verification', script: 'tests/p0-p1-fixes-verification.test.ts' },
  { name: 'Bulk Product Editor Verification', script: 'tests/bulk-editor-verification.test.ts' },
  { name: 'Wall, Split and Mix & Match Builders', script: 'tests/print-builders.test.ts' },
  { name: 'Wall Layout Manager Utility', script: 'tests/wall-layout-manager.test.ts' },
  { name: 'Server Hardening Helpers', script: 'tests/hardening.test.ts' },
  { name: 'Server Integration (production defaults)', script: 'tests/server-integration.test.ts' },
  { name: 'Data Store Backends', script: 'tests/store.test.ts' },
  { name: 'Server on the Data Store (end to end)', script: 'tests/store-integration.test.ts' },
];

console.log('======================================================================');
console.log('RUNNING ALL MEMOPRINT TEST SUITES');
console.log('======================================================================\n');

let allPassed = true;
const results: Array<{ name: string; status: 'PASS' | 'FAIL'; error?: string }> = [];

for (const suite of testSuites) {
  process.stdout.write(`Executing: ${suite.name}... `);
  try {
    execSync(`npx tsx ${suite.script}`, { stdio: 'pipe', env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'test' } });
    console.log('✅ PASS');
    results.push({ name: suite.name, status: 'PASS' });
  } catch (err: any) {
    console.log('❌ FAIL');
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    const stdout = err.stdout ? err.stdout.toString() : '';
    console.error(`\n--- ERROR IN SUITE: ${suite.name} ---\n${stdout}\n${stderr}\n-----------------------------------\n`);
    results.push({ name: suite.name, status: 'FAIL', error: stderr });
    allPassed = false;
  }
}

console.log('\n======================================================================');
console.log('MEMOPRINT UNIFIED TEST REPORT');
console.log('======================================================================');
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? '✅' : '❌'} ${r.name.padEnd(45)} [${r.status}]`);
}
console.log('======================================================================');

if (!allPassed) {
  console.error('\nUnified test run failed.');
  process.exit(1);
} else {
  console.log('\nAll test suites passed cleanly.');
  process.exit(0);
}
