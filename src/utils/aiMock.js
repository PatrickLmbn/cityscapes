import { v4 as uuidv4 } from 'uuid';

// Extremely basic mock for our AI
// In a real app, this would hit an LLM API
export function analyzeThought(text) {
  const lower = text.toLowerCase();
  
  let intensity = 5; // 1 to 10
  let positivity = 5; // 1 to 10
  
  // keywords
  const intenseWords = ['rage', 'hate', 'millionaire', 'love', 'amazing', 'huge', 'terrible', 'perfect', 'money', 'rich'];
  const positiveWords = ['happy', 'love', 'millionaire', 'great', 'peace', 'good', 'beautiful', 'rich'];
  const negativeWords = ['sad', 'rage', 'hate', 'bad', 'angry', 'depressed', 'cry', 'terrible', 'lonely', 'lost'];
  
  for (const word of intenseWords) {
    if (lower.includes(word)) intensity += 2;
  }
  for (const word of positiveWords) {
    if (lower.includes(word)) positivity += 2;
  }
  for (const word of negativeWords) {
    if (lower.includes(word)) positivity -= 2;
  }
  
  // Bounds
  intensity = Math.max(1, Math.min(10, intensity));
  positivity = Math.max(1, Math.min(10, positivity));
  
  // Decide building properties based on these simulated metrics
  // Height based on intensity + length of thought
  const baseHeight = 2 + (intensity * 1.5) + (text.length * 0.05); 
  const actualHeight = Math.min(baseHeight, 40); // Max height capping
  
  // Color palette for "noir" vibe
  let color = '#222222'; // Default dark concrete
  let windowColor = '#ffea00'; // Default warm light
  
  if (positivity >= 8) {
    // Very positive: bright, perhaps neon highlights
    windowColor = '#00ffff'; // Cyan
  } else if (positivity <= 3) {
    // Negative/angry/sad
    windowColor = '#ff003c'; // Red
  } else if (positivity > 5) {
    windowColor = '#00ff88'; // green/teal
  }
  
  // Random placement on the grid
  // We want them to spread out from the center (0,0) somewhat randomly
  const r = 5 + Math.random() * 60; // distance from center
  const theta = Math.random() * 2 * Math.PI;
  const x = r * Math.cos(theta);
  const z = r * Math.sin(theta);
  
  return {
    id: uuidv4(),
    text,
    height: actualHeight,
    width: 2 + Math.random() * 3,
    depth: 2 + Math.random() * 3,
    color: color,
    windowColor: windowColor,
    intensity: intensity,
    x: x,
    z: z,
    timestamp: Date.now()
  };
}
