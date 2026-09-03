require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

const geminiClient = require('../geminiClient');
const { buildPrompt, buildAnalysisPayload } = require('../prompts');
const { parseResponse } = require('../responseParser');
const { validateAnalysis } = require('../aiGuardrails');

const SYNTHETIC_EXCEPTION = {
  paymentId: 'PAY-TEST-001',
  bankTransactionId: 'BANK-TEST-001',
  invoiceId: 'INV-TEST-001',
  status: 'EXCEPTION',
  exceptionType: 'AMOUNT_MISMATCH',
  paymentAmount: 10000.00,
  bankAmount: 9500.00,
  invoiceAmount: 10000.00,
  amountDifference: 500.00,
  dateDifferenceDays: 0,
};

async function runSmokeTest() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ReconEDGE AI — Live Gemini Smoke Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!process.env.GEMINI_API_KEY) {
    console.log('Status: SKIPPED — API key not configured');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
  }

  console.log('Model:', geminiClient.getModelName());
  console.log('API key: [REDACTED]');
  console.log('');

  const initialized = geminiClient.initializeClient();
  if (!initialized) {
    console.log('Status: FAILED — Could not initialize Gemini client');
    process.exit(1);
  }
  console.log('✓ Gemini client initialized');

  const payload = buildAnalysisPayload(SYNTHETIC_EXCEPTION);
  console.log('✓ Payload built (no ground-truth fields)');

  const groundTruthFields = ['expectedScenario', 'expectedBankTransactionId', 'expectedInvoiceId', 'ground-truth', 'groundTruth'];
  const hasGT = Object.keys(payload).some((k) => groundTruthFields.includes(k));
  if (hasGT) {
    console.log('✗ FAIL: Payload contains ground-truth fields');
    process.exit(1);
  }
  console.log('✓ Ground-truth isolation verified');

  const prompt = buildPrompt(SYNTHETIC_EXCEPTION);
  console.log('✓ Prompt constructed');

  console.log('\nCalling Gemini API...');
  const startTime = Date.now();

  try {
    const rawText = await geminiClient.generateContent(prompt);
    const elapsed = Date.now() - startTime;
    console.log(`✓ Response received in ${elapsed}ms`);

    console.log('\nParsing response...');
    const parsed = parseResponse(rawText);
    if (!parsed) {
      console.log('✗ FAIL: Could not parse response');
      console.log('Raw:', rawText.substring(0, 200));
      process.exit(1);
    }
    console.log('✓ Response parsed successfully');

    console.log('\nValidating through guardrails...');
    const validation = validateAnalysis(parsed);
    if (!validation.valid) {
      console.log('✗ FAIL: Guardrails rejected response:', validation.error);
      process.exit(1);
    }
    console.log('✓ Guardrails passed');

    console.log('\n━━━ AI Analysis Result ━━━');
    console.log('Summary:', validation.data.summary);
    console.log('Likely Cause:', validation.data.likelyCause);
    console.log('Risk Level:', validation.data.riskLevel);
    console.log('Confidence:', validation.data.confidence);
    console.log('Requires Human Review:', validation.data.requiresHumanReview);
    console.log('Recommended Actions:');
    validation.data.recommendedActions.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Status: PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`✗ FAIL after ${elapsed}ms:`, error.message);
    process.exit(1);
  }
}

runSmokeTest();
