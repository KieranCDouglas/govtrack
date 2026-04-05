import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import PerplexityAttribution from "@/components/PerplexityAttribution";
import { Sun, Moon, Menu, X, Vote, Map, HelpCircle, Users, Home, ScrollText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/members", label: "Members", icon: Users },
  { href: "/compass", label: "Compass", icon: Map },
  { href: "/ballot", label: "Ballot Measures", icon: ScrollText },
  { href: "/quiz", label: "Take the Quiz", icon: HelpCircle },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 backdrop-blur-md bg-background/80">

        {/* ── Mobile header: logo row + hamburger ── */}
        <div className="md:hidden flex items-center justify-between px-4 py-2">
          <div className="flex-1" />
          <Link href="/" className="flex-1 flex justify-center">
            <img src="./civicism-logo.png" alt="Civicism logo" style={{height:"160px",width:"auto"}} />
          </Link>
          <div className="flex-1 flex justify-end items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              data-testid="button-theme-toggle"
              className="h-8 w-8"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* ── Desktop header: single row ── */}
        <div className="hidden md:grid max-w-7xl mx-auto px-4 w-full" style={{gridTemplateColumns:"1fr auto 1fr", height:"clamp(240px, 34vw, 440px)"}}>
          <Link href="/" className="flex items-center">
            <img src="./civicism-logo.png" alt="Civicism logo" style={{height:"clamp(240px, 34vw, 440px)",width:"auto"}} />
          </Link>
          <nav className="flex items-center justify-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  location === item.href
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              data-testid="button-theme-toggle"
              className="h-8 w-8"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile Nav dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border/60 bg-background/95 px-4 py-3 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  location === item.href
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
          </div>
        </div>
      </footer>
    </div>
  );
}
