export interface KProduct {
  name: string; slug: string; type: string; texture: string | null; construction: string | null; material: string | null; lace: string | null;
  description: string | null; care: string | null; lengths: number[]; colors: string[];
  minPriceMinor: number | null; maxPriceMinor: number | null; priceText: string | null; availability: string; onSale: boolean;
  rating: { avg: number; count: number } | null;
}
export interface KRate { name: string; method: string; costText: string; costMinor: number; days: string | null; dutiesNote: string | null; freeOverText: string | null }
export interface KZone { name: string; countries: string[]; rates: KRate[] }
export interface KOrder { number: string; status: string; totalText: string; totalMinor: number; tracking: { carrier: string | null; number: string | null; url: string | null } | null }
export interface Knowledge {
  currency: string; products: KProduct[]; categories: { name: string; slug: string }[];
  policies: Record<string, { title: string; body: string }>; shipping: KZone[];
  contact: { whatsappUrl: string | null; email: string | null; hours: string | null };
  /** Present only for a signed-in customer, and only their own most recent orders. Never includes addresses. */
  orders: KOrder[] | null;
}
export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ProductRef { name: string; slug: string; priceText: string | null; availability: string }
export interface AssistantReply {
  answer: string; products: ProductRef[]; handoff: boolean; source: 'ai' | 'rules';
  outcome: 'answered' | 'fallback' | 'blocked';
  usage?: { inputTokens: number; outputTokens: number; latencyMs: number; model: string };
}
export interface ProviderResult { text: string; inputTokens: number; outputTokens: number; model: string }
export interface AssistantProvider { complete(input: { system: string; messages: ChatMessage[] }): Promise<ProviderResult> }
