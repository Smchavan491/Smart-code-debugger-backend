import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY;
console.log('KEY_LAST_4:', key ? key.slice(-4) : 'MISSING');

const ai = new GoogleGenAI({ apiKey: key });
console.log('AI_PROPS:', Object.keys(ai));

ai.models.generateContent({
  model: 'gemini-1.5-flash',
  contents: [{ role: 'user', parts: [{ text: 'Hi' }] }]
})
.then(res => {
  console.log('API_SUCCESS:', JSON.stringify(res));
  process.exit(0);
})
.catch(err => {
  console.log('API_ERROR:', err.message);
  // try to extract more info if available
  if (err.response) console.log('API_RESPONSE:', JSON.stringify(err.response));
  process.exit(1);
});
