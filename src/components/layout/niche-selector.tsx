'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { NICHES } from '@/config/niches';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface NicheSelectorProps {
  className?: string;
}

export function NicheSelector({ className }: NicheSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentNicheId = searchParams.get('niche') ?? 'beach-tennis';
  const currentNiche = NICHES.find((n) => n.id === currentNicheId) ?? NICHES[0];

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'beach-tennis') {
      params.delete('niche');
    } else {
      params.set('niche', value);
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={currentNicheId} onValueChange={handleChange}>
      <SelectTrigger
        className={cn('font-semibold border-0 shadow-none focus:ring-0 px-1', className)}
      >
        <SelectValue>
          <span className="flex items-center gap-2">
            <span>{currentNiche.icon}</span>
            <span className="truncate">{currentNiche.label}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {NICHES.map((n) => (
          <SelectItem key={n.id} value={n.id}>
            <span className="flex items-center gap-2">
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
