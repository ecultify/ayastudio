// Anya Mehra's brand persona + content strategy. This is configuration (the
// client's real brief), not fetched data — it drives the LLM scoring/Pulse
// prompts and the dashboard's content-pillars panel. The knowledge base and
// Pulse reports layer on top of this to further shape Anya's voice (see
// src/lib/context.ts).

export const ANYA_PERSONA = {
  name: "Anya Mehra",
  shortName: "Anya",
  summary:
    "a Mumbai-based AI music artist — a DJ/producer influencer. Culture-first, premium, witty, recognisably Mumbai. Her world is sound, nightlife, studio craft, monsoon-city aesthetics, and South-Asian global music identity.",
  audience: "Gen-Z and young-millennial music & culture audiences in Mumbai / India and the South-Asian diaspora.",
  brief: [
    "Pillars: Sound of Mumbai (local realism), Studio/Producer (music credibility),",
    "Nightlife/DJ (aspirational energy), Style/Identity (recognisable persona),",
    "Match-Night Culture (brand relevance, culture-first), Community/Trends (participation).",
  ].join(" "),
  brandSafety: [
    "Culture-first always. NO betting/gambling/wagering cues, even around cricket or match-night content —",
    "keep it about the culture, the crowd, the sound. Avoid over-glam beyond the brand voice,",
    "anything political, religious-sensitive, explicit, or that reads as an unlicensed brand endorsement.",
    'Mark such items "Review" (borderline / needs a human) or "Avoid" (off-brand / unsafe).',
  ].join(" "),
} as const

// Backwards-compatible alias (the brand was previously "Aya").
export const AYA_PERSONA = ANYA_PERSONA

// The brand's monthly content pillars (configured strategy, shown on the dashboard).
export const CONTENT_PILLARS = [
  { name: "Sound of Mumbai", role: "Local realism", reels: 2, statics: 1 },
  { name: "Studio / Producer", role: "Music credibility", reels: 2, statics: 1 },
  { name: "Nightlife / DJ", role: "Aspirational energy", reels: 2, statics: 2 },
  { name: "Style / Identity", role: "Recognisable persona", reels: 1, statics: 2 },
  { name: "Match-Night Culture", role: "Brand relevance", reels: 2, statics: 2 },
  { name: "Community / Trends", role: "Participation", reels: 1, statics: 2 },
]
