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
  // v2: adicionar novos nichos aqui (futsal, surf, padel, etc.)
];

export const DEFAULT_NICHE = NICHES[0];
