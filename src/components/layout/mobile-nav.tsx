'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { NavLinks } from './nav-links';
import { NicheSelector } from './niche-selector';
import { Separator } from '@/components/ui/separator';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-9 w-9"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b px-4 py-4">
            <SheetTitle className="text-left">
              <NicheSelector />
            </SheetTitle>
          </SheetHeader>
          <div className="px-3 py-4">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <Separator />
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Pipeline v1.0</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
