export interface ModelOption {
  id: string;
  name: string;
  quotaTag: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "gemini-flash-latest", name: "Gemini Flash", quotaTag: "Fast & Reliable" },
  { id: "gemini-flash-lite-latest", name: "Gemini Flash Lite", quotaTag: "Low Latency" },
  { id: "nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5", quotaTag: "OpenRouter Free" },
  { id: "cohere/north-mini-code:free", name: "Cohere Code", quotaTag: "OpenRouter Free" },
];
