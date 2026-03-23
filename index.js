import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// In-memory caching system
const cache = new Map();

// ---------------- TIME COMPLEXITY ----------------
function estimateTimeComplexity(code, language = "javascript") {
  if (!code) return "O(1)";
  let maxDepth = 0;
  let currentDepth = 0;
  const lines = code.split('\n');
  const isPython = (language || '').toLowerCase() === 'python';
  
  for (const line of lines) {
    if (isPython) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      // Simple indent estimation for Python (assumes 4 spaces)
      const indent = line.search(/\S|$/);
      currentDepth = Math.floor(indent / 4);
      if (line.trim().match(/^(for|while)\b/)) {
        currentDepth++;
        if (currentDepth > maxDepth) maxDepth = currentDepth;
      }
    } else {
      const trimmed = line.trim();
      if (
        trimmed.match(/^(for|while|do)\b/) ||
        trimmed.includes('.map(') ||
        trimmed.includes('.forEach(') ||
        trimmed.includes('.filter(') ||
        trimmed.includes('.reduce(')
      ) {
        currentDepth++;
        if (currentDepth > maxDepth) maxDepth = currentDepth;
      }
      if (trimmed.includes('}')) {
        if (currentDepth > 0) currentDepth--;
      }
    }
  }
  
  if (maxDepth === 0) return "O(1)";
  if (maxDepth === 1) return "O(n)";
  if (maxDepth === 2) return "O(n^2)";
  return `O(n^${maxDepth})`;
}

// ---------------- FALLBACK ----------------
function fallbackAnalysis(code, language) {
  return {
    bugs: "⚠️ AI unavailable. No critical bugs detected, but verify logic manually.",
    optimization: "Consider improving logic and reducing nested loops.",
    complexity: estimateTimeComplexity(code, language),
    score: "6",
    qualityScore: 6,
    problematicLines: [],
    analyzedBy: "fallback"
  };
}

// ---------------- SAFE JSON PARSER ----------------
function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Invalid JSON from AI");
  }
}

// ---------------- ROUTES ----------------
app.get('/', (req, res) => {
  res.send('🚀 Backend Running (Groq Fixed)');
});

app.post('/analyze', async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language required' });
    }

    const cacheKey = crypto
      .createHash('md5')
      .update(language + code)
      .digest('hex');

    // (optional cache disabled for testing)
    // if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    const GROQ_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_KEY) {
      return res.json(fallbackAnalysis(code, language));
    }

    const prompt = `
You are a senior software engineer and static code analysis system.

The input code may come from various sources such as:
- Competitive programming platforms (LeetCode, Codeforces, CodeChef, HackerRank)
- Real-world projects
- Browser extensions (possibly incomplete or messy code)

The programming language MAY NOT be provided. You MUST detect it yourself.

-------------------------------
🔍 STEP 1: LANGUAGE DETECTION
-------------------------------
Detect the programming language using syntax patterns:

- C++ → #include, vector<>, std::, ->, pointers (*)
- Java → public class, System.out.println, main(String[])
- Python → def, indentation, no semicolons
- JavaScript → function, console.log, =>
- TypeScript → interface, type annotations (: string, : number)
- C → printf, scanf, #include <stdio.h>

Return the detected language in output.

STRICT RULE:
- Never confuse languages
- Never give errors for a different language
- If unsure → return "unknown"

-------------------------------
🧠 STEP 2: ANALYSIS RULES
-------------------------------
Analyze the code ONLY based on the detected language.

Focus ONLY on:
1. Logical bugs (wrong output, infinite loops, crashes)
2. Critical runtime issues
3. Algorithmic inefficiencies

IGNORE:
- Minor style issues
- Formatting
- Naming conventions

-------------------------------
⚠️ BUG DETECTION RULES
-------------------------------
- Report ONLY real bugs
- Do NOT invent problems
- If code is correct → say "No critical bugs found"

-------------------------------
⚡ OPTIMIZATION RULES
-------------------------------
- Suggest improvements ONLY if meaningful
- Focus on time complexity improvements
- Avoid generic advice
- If the algorithm is already optimal → exactly say "No optimizations needed. The code is already optimally written."
- If the Time Complexity is optimal → do NOT suggest alternative algorithms.

-------------------------------
📊 COMPLEXITY RULES
-------------------------------
- Provide Big-O time complexity
- Use standard notation:
  n = size of input
  m = rows
  L = recursion depth / string length

-------------------------------
🛑 ANTI-HALLUCINATION RULES
-------------------------------
- Do NOT mention other languages
- Do NOT assume missing context incorrectly
- Do NOT generate fake errors
- Do NOT explain outside JSON

If analysis is uncertain:
→ return safe response with best effort

-------------------------------
📦 OUTPUT FORMAT (STRICT JSON)
-------------------------------
Return ONLY this JSON:

{
  "detectedLanguage": "",
  "bugs": "",
  "optimization": "",
  "complexity": "",
  "score": "8/10",
  "qualityScore": 8,
  "problematicLines": []
}

-------------------------------
⭐ QUALITY SCORE RULE
-------------------------------
- 9–10 → optimal code
- 7–8 → good but minor improvements possible
- 5–6 → moderate issues
- <5 → serious issues

-------------------------------
📌 FINAL INSTRUCTION
-------------------------------
- Output ONLY JSON
- No markdown
- No explanation outside JSON

-------------------------------
CODE TO ANALYZE:
${code}`;


    console.log("🚀 Calling Groq...");

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile', // 🔥 THE SMARTEST MODEL FOR EXPERT ANALYSES
        messages: [
          {
            role: 'system',
            content: 'You are a strict code analyzer. You MUST return ONLY valid JSON matching the exact schema requested. Do not output anything else.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2048, // Prevent JSON cutoff with large models
        response_format: { type: "json_object" }
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const raw = response.data.choices?.[0]?.message?.content;

    console.log("🧠 AI RAW:", raw);

    const data = parseJSON(raw);

    const result = {
      bugs: data.bugs || "No bugs found",
      optimization: data.optimization || "Code is fine",
      complexity: data.complexity || estimateTimeComplexity(code, language),
      score: data.score?.toString() || "9",
      qualityScore: parseInt(data.qualityScore) || 9,
      problematicLines: Array.isArray(data.problematicLines)
        ? data.problematicLines.map(Number).filter(n => !isNaN(n))
        : [],
      analyzedBy: "llama-3.3-70b-versatile"
    };

    cache.set(cacheKey, result);

    res.json(result);

  } catch (err) {
    console.error("❌ FULL ERROR:", err.response?.data || err.message); // ✅ DEBUG FIX
    res.json(fallbackAnalysis(req.body.code, req.body.language));
  }
});

// ---------------- SERVER ----------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on ${PORT}`);
});