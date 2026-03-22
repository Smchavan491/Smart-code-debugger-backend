import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health Check route for Render
app.get('/', (req, res) => {
  res.send('Smart Code Debugger API is running!');
});

// Initialize Google Gen AI
const apiKey = process.env.GEMINI_API_KEY?.trim();
const isRealKey = apiKey && apiKey !== 'your_api_key_here';
console.log(`Backend: GEMINI_API_KEY is ${isRealKey ? 'configured' : 'NOT CONFIGURED'}`);

const ai = isRealKey ? new GoogleGenAI({ apiKey }) : null;

// Manual logic for time complexity based strictly on loop counting
function estimateTimeComplexity(code) {
  if (!code) return "O(1)";
  let maxDepth = 0;
  let currentDepth = 0;
  const lines = code.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^(for|while)\s*\(|\s(for|while)\s*\(/)) {
      currentDepth++;
      if (currentDepth > maxDepth) maxDepth = currentDepth;
    }
    if (trimmed.includes('}')) {
      if (currentDepth > 0) currentDepth--;
    }
  }
  if (maxDepth === 0) return "O(1)";
  if (maxDepth === 1) return "O(n)";
  if (maxDepth === 2) return "O(n^2)";
  if (maxDepth === 3) return "O(n^3)";
  return `O(n^${maxDepth})`;
}

app.post('/analyze', async (req, res) => {
  try {
    const { code, language } = req.body;
    console.log(`Backend: Analyzing ${language} code (${code ? code.length : 0} chars)`);

    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    const complexity = estimateTimeComplexity(code);

    if (!ai) {
      console.log('No valid GEMINI_API_KEY found, returning mock response.');
      return res.json({
        bugs: "Potential infinite loop detected. Missing bracket.",
        optimization: "Cache computations and avoid nested loops where possible.",
        complexity: complexity,
        score: "6",
        qualityScore: 6
      });
    }

    const prompt = `
      You are an expert ${language} code reviewer. Analyze the following code.
      1. IGNORE header files, minor style issues, and standard imports.
      2. FOCUS ONLY on logical bugs, critical faults, and better algorithmic suggestions.
      3. Give short, direct, and clear answers.

      Your response MUST be valid JSON, with exactly the following keys:
      - "bugs": A short string exposing only actual logical bugs or critical faults.
      - "optimization": A short suggestion for a better algorithm or better approach.
      - "score": A numeric score from 1-10 based on code quality.
      
      Note: We handle time complexity externally, so do not output it.

      Code to analyze:
      \`\`\`${language}
      ${code}
      \`\`\`
    `;

    console.log('Backend: Calling AI...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const candidateText = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      console.error('Backend: No candidates in AI response:', JSON.stringify(response, null, 2));
      throw new Error("AI failed to return valid analysis text.");
    }

    let rawText = candidateText;

    try {
      console.log('Backend: Parsing response JSON...');
      const startIdx = rawText.indexOf('{');
      const endIdx = rawText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
          rawText = rawText.substring(startIdx, endIdx + 1);
      }

      const resultData = JSON.parse(rawText);
      console.log('Backend: Parse successful');
      
      const scoreValue = resultData.score?.toString() || "10";
      
      res.json({
        bugs: resultData.bugs || "No concerns found.",
        optimization: resultData.optimization || "Code is well-optimized.",
        complexity: complexity,
        score: scoreValue,
        qualityScore: parseInt(scoreValue) || 10
      });

    } catch (parseError) {
      console.error('Backend: Parse Error. Raw response:', rawText);
      res.status(500).json({ error: 'Failed to parse AI response: ' + parseError.message });
    }

  } catch (error) {
    console.error('Backend: Error during analysis:', error);
    res.status(500).json({ error: error.message || 'An error occurred during code analysis' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});