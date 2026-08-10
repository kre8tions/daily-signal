// Shared primitives for action / next-step cards.
// Extracted from EditionView so the article page can render the same card without
// duplicating the visual language — if these drift, the S1 Insight "next step" stops
// matching the edition action cards it is meant to echo.

export function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export const ACTION_CARD_EMOJIS = ["🎯", "⚡", "🔥"];
export const ACTION_CARD_SEEDS = [15, 16, 17];
export const MOVE_LABELS = ["Your Next Move", "One Move", "Take Action", "Begin Here", "First Step", "Act On It"];

// Edition seed used by every card that varies per edition rather than per card.
export function editionSeed(editionKey: string): number {
  return editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
}
