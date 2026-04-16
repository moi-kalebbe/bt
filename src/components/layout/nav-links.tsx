'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutGrid, CalendarDays, Settings, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Vídeos', icon: LayoutGrid },
  { href: '/admin/news', label: 'Notícias', icon: Newspaper },
  { href: '/admin/schedule', label: 'Agendamento', icon: CalendarDays },
  { href: '/admin/settings', label: 'Configurações', icon: Settings },
];

interface NavLinksProps {
  onNavigate?: () => void;
}

export function NavLinks({ onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const niche = searchParams.get('niche');

  function buildHref(base: string) {
    if (!niche || niche === 'beach-tennis') return base;
    return `${base}?niche=${niche}`;
  }

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={buildHref(href)}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
