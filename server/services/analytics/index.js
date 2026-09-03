const fs = require('fs');
const path = require('path');
const { generateAnalytics } = require('./analyticsEngine');

function loadJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function main() {
  const dataDir = path.join(__dirname, '..', '..', '..', 'data', 'generated');

  console.log('');
  console.log('\u2501'.repeat(50));
  console.log('ReconEDGE AI \u2014 Metrics & Analytics');
  console.log('\u2501'.repeat(50));
  console.log('');

  console.log('Loading reconciliation results...');
  const resultsPath = path.join(dataDir, 'reconciliation-results.json');
  if (!fs.existsSync(resultsPath)) {
    console.error('\u2717 reconciliation-results.json not found');
    console.error('Run: npm run reconcile:data');
    process.exit(1);
  }
  const results = loadJsonFile(resultsPath);
  console.log('\u2713 Loaded reconciliation results');

  console.log('');
  console.log('Loading reconciliation metrics...');
  const metricsPath = path.join(dataDir, 'reconciliation-metrics.json');
  if (!fs.existsSync(metricsPath)) {
    console.error('\u2717 reconciliation-metrics.json not found');
    console.error('Run: npm run reconcile:data');
    process.exit(1);
  }
  const metrics = loadJsonFile(metricsPath);
  console.log('\u2713 Loaded reconciliation metrics');

  console.log('');
  console.log('Calculating reconciliation metrics...');
  const analytics = generateAnalytics(results, metrics);
  console.log('\u2713 Matching analytics calculated');

  console.log('');
  console.log('Calculating exception analytics...');
  console.log('\u2713 Exception analytics calculated');

  console.log('');
  console.log('Calculating financial impact...');
  console.log('\u2713 Financial analytics calculated');

  console.log('');
  console.log('Calculating control effectiveness...');
  console.log('\u2713 Control metrics calculated');

  console.log('');
  console.log('Calculating reconciliation health...');
  console.log('\u2713 Health status calculated');

  const analyticsPath = path.join(dataDir, 'reconciliation-analytics.json');
  fs.writeFileSync(analyticsPath, JSON.stringify(analytics, null, 2));

  console.log('');
  console.log('Output:');
  console.log('\u2713 reconciliation-analytics.json');
  console.log('');
  console.log('\u2501'.repeat(50));
}

main();
