const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const TIMEOUT_MS = 60000;

let genAI = null;
let model = null;

function initializeClient() {
  if (!API_KEY) return false;
  try {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ model: MODEL });
    return true;
  } catch {
    return false;
  }
}

function isAvailable() {
  return model !== null;
}

function getModelName() {
  return MODEL;
}

function getClient() {
  return model;
}

function configure({ apiKey, model: modelName } = {}) {
  if (apiKey) process.env.GEMINI_API_KEY = apiKey;
  if (modelName) process.env.GEMINI_MODEL = modelName;
  genAI = null;
  model = null;
  return initializeClient();
}

async function generateContent(prompt) {
  if (!model) {
    throw new Error('AI_NOT_CONFIGURED');
  }
  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI_TIMEOUT')), TIMEOUT_MS)
    ),
  ]);
  const response = result.response;
  return response.text();
}

module.exports = {
  initializeClient,
  isAvailable,
  getModelName,
  getClient,
  configure,
  generateContent,
  TIMEOUT_MS,
};
