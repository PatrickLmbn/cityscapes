import { v4 as uuidv4 } from 'uuid';

const API_KEY = import.meta.env.VITE_OR_KEY;
const MODEL   = import.meta.env.VITE_MODEL || 'google/gemini-2.5-flash-lite';

// ── Rate limiter (token bucket) ──────────────────────────
// Max 5 submissions per 60-second window.
const RATE_LIMIT    = 5;
const WINDOW_MS     = 60_000;           // 1 minute
const REFILL_MS     = WINDOW_MS / RATE_LIMIT; // 12 s per token

let tokens        = RATE_LIMIT;
let lastRefill    = Date.now();

function consumeToken() {
  // Refill tokens based on elapsed time
  const now     = Date.now();
  const elapsed = now - lastRefill;
  const gained  = Math.floor(elapsed / REFILL_MS);
  if (gained > 0) {
    tokens     = Math.min(RATE_LIMIT, tokens + gained);
    lastRefill = now - (elapsed % REFILL_MS);
  }

  if (tokens <= 0) {
    const waitMs  = REFILL_MS - (Date.now() - lastRefill);
    const waitSec = Math.ceil(waitMs / 1000);
    const err     = new Error(`Rate limit reached. Try again in ${waitSec} second${waitSec !== 1 ? 's' : ''}.`);
    err.name      = 'RateLimitError';
    err.waitSec   = waitSec;
    throw err;
  }

  tokens -= 1;
}

export function getRateLimitStatus() {
  // Trigger a refill calc so the returned value is current
  const now     = Date.now();
  const elapsed = now - lastRefill;
  const gained  = Math.floor(elapsed / REFILL_MS);
  const current = Math.min(RATE_LIMIT, tokens + gained);
  return { tokens: current, max: RATE_LIMIT };
}

/**
 * Calls Gemini via OpenRouter to analyze the user's thought.
 * Returns structured JSON with building parameters.
 */
export async function analyzeThought(text) {
  // Throws RateLimitError if over limit — caller should catch and surface to user
  consumeToken();

  const prompt = `
You are an emotion and thought analysis engine for a noir cityscape app called CityScapes.
Given the user's text, return ONLY a valid JSON object with the following fields:

- intensity (number 1-10): How emotionally strong or powerful the thought is. A mild passing thought is 1-2, a deep rage or massive ambition is 9-10.
- valence (number 1-10): 1 = very dark/negative (rage, grief, despair), 10 = very positive/hopeful (joy, love, ambition).
- complexity (number 1-10): 1 = simple/single feeling, 10 = chaotic/multi-layered emotions.
- theme (string): one of: "ambition", "rage", "sadness", "joy", "anxiety", "love", "nostalgia", "peace", "fear", "hate".
- label (string): a short 2-5 word poetic label for this building. e.g. "Tower of Desire", "Monument of Grief".

User thought: "${text.replace(/"/g, "'")}"

Respond ONLY with the JSON object. No explanation, no markdown, no code block.
`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();

    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return buildFromAnalysis(text, parsed);
  } catch (err) {
    console.error('AI analysis failed, using fallback:', err);
    return buildFallback(text);
  }
}

/**
 * Analyzes a comment to determine its sentiment for building growth.
 */
export async function analyzeComment(text) {
  consumeToken();

  const prompt = `
Critically analyze the sentiment of this reply message.
You must detect if the reply is supportive or hostile.

Return ONLY a valid JSON object with:
- valence (number 1-10): 
    - 1-3: Hostile, mean, threatening, bullying, discouraging, or mocking.
    - 4-7: Neutral, informational, or ambiguous.
    - 8-10: Truly supportive, kind, healing, or compassionate.
- intensity (number 1-10): How strong the emotion is.

EXAMPLES:
- "kill your cats" -> valence: 1, intensity: 10
- "dont do that" (to a positive thought) -> valence: 3, intensity: 5
- "value your life" -> valence: 10, intensity: 8
- "you are alone" -> valence: 2, intensity: 6

Reply text: "${text.replace(/"/g, "'")}"

Respond with ONLY JSON. No explanation.
`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Comment analysis failed:', err);
    return { valence: 5, intensity: 5 };
  }
}

/**
 * Maps AI analysis to building parameters.
 */
function buildFromAnalysis(text, analysis) {
  const { intensity = 5, valence = 5, complexity = 5, theme = 'peace', label = 'Structure' } = analysis;

  // Height is driven by intensity (1-10 → 4 to 50 units)
  const height = 4 + (intensity - 1) * 5.1;

  // Building width/depth (complexity adds some variation)
  const width = 3 + (complexity * 0.4) + Math.random() * 1.5;
  const depth = 3 + (complexity * 0.3) + Math.random() * 1.5;

  // Window brightness increases with positivity
  const windowBrightness = 0.3 + (valence / 10) * 1.2;

  // Window color based on theme
  const themeWindows = {
    ambition:  '#ffc947',  // gold
    rage:      '#ff2233',  // red
    sadness:   '#3a6ea8',  // muted blue
    joy:       '#00ffcc',  // cyan
    anxiety:   '#aa44ff',  // purple
    love:      '#ff79a8',  // pink
    nostalgia: '#ff9944',  // amber
    peace:     '#88ffbb',  // soft green
    fear:      '#ff6600',  // orange
    hate:      '#cc0011',  // deep red
  };
  const windowColor = themeWindows[theme] || '#ffea00';

  // Dark emotions (valence < 4) → spawn close to center
  // Bright emotions → spawn further out
  const closeness = Math.max(0, (5 - valence) / 5); // 0 far, 1 very close
  const minR = 5 + ((1 - closeness) * 15);
  const maxR = minR + (complexity * 2) + 10;
  const r = minR + Math.random() * (maxR - minR);
  const theta = Math.random() * 2 * Math.PI;

  return {
    id: uuidv4(),
    text,
    label,
    theme,
    height,
    width,
    depth,
    windowColor,
    windowBrightness,
    floors: Math.floor(height / 3.5), // one floor per ~3.5 units
    intensity,
    valence,
    complexity,
    x: r * Math.cos(theta),
    z: r * Math.sin(theta),
    timestamp: Date.now(),
  };
}

/**
 * Fallback when API fails.
 */
function buildFallback(text) {
  const intensity = Math.min(10, 3 + Math.floor(text.length / 20));
  const valence = 5;
  return buildFromAnalysis(text, { intensity, valence, complexity: 5, theme: 'peace', label: 'Unknown Structure' });
}
