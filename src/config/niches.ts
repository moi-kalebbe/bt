export interface Niche {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
}

export const NICHES: Niche[] = [
  {
    id: 'beach-tennis',
    label: 'Beach Tennis',
    icon: '🎾',
    description: 'Conteúdo de beach tennis',
    color: 'text-orange-500',
  },
  {
    id: 'ai-tech',
    label: 'IA & Tech',
    icon: '🤖',
    description: 'IA, automação, LLM e vibe coding',
    color: 'text-blue-500',
  },
];

export const DEFAULT_NICHE = NICHES[0];
