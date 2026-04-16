'use client';

import { ChevronDown } from 'lucide-react';
import { DEFAULT_NICHE } from '@/config/niches';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NicheSelectorProps {
  className?: string;
}

export function NicheSelector({ className }: NicheSelectorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent cursor-not-allowed opacity-80',
            className
          )}
          disabled
          aria-label="Seletor de nicho (em breve)"
        >
          <span className="text-base">{DEFAULT_NICHE.icon}</span>
          <span className="truncate">{DEFAULT_NICHE.label}</span>
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">Multi-nicho em breve</TooltipContent>
    </Tooltip>
  );
}
