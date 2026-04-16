import { MobileNav } from './mobile-nav';
import { ThemeToggle } from './theme-toggle';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 md:px-6">
      <MobileNav />
      <div className="flex-1" />
      <ThemeToggle />
    </header>
  );
}
