import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NavLinks } from './nav-links';
import { NicheSelector } from './niche-selector';

export function AppSidebar() {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <NicheSelector className="w-full" />
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <NavLinks />
      </ScrollArea>
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">Pipeline v1.0</p>
      </div>
    </aside>
  );
}
