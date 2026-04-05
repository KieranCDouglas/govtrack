import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import PerplexityAttribution from "@/components/PerplexityAttribution";
import { Sun, Moon, Menu, X, Vote, Map, HelpCircle, Users, Home, ScrollText, Info } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/members", label: "Members", icon: Users },
  { href: "/compass", label: "Compass", icon: Map },
  { href: "/ballot", label: "Ballot Measures", icon: ScrollText },
  { href: "/quiz", label: "Take the Quiz", icon: HelpCircle },
  { href: "/about", label: "About", icon: Info },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 backdrop-blur-md bg-background/80" style={{overflow:"visible"}}>

        {/* ── Single unified bar: [logo left] [nav/burger center] [toggle right] ── */}
        {/* Header height tracks logo on mobile, fixed on desktop */}
        <div className="max-w-7xl mx-auto px-4 flex items-center" style={{height:"clamp(64px, 20vw, 100px)"}}>

          {/* Left: logo — scales with header on mobile, fixed 288px on desktop */}
          <Link href="/" className="shrink-0 flex items-center" style={{position:"relative", left:"-4px", top:"2px"}}>
            <img src="./civicism-logo.png" alt="Civicism logo"
              style={{
                height:"clamp(60px, 19vw, 288px)",
                width:"auto",
                objectFit:"contain",
              }}
            />
          </Link>

          {/* Center: hamburger (mobile) or nav links (desktop) */}
          <div className="flex-1 flex items-center justify-center gap-1">
            {/* Hamburger — mobile/narrow only */}
            <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
            {/* Desktop nav links */}
            <nav className="hidden lg:flex items-center gap-1 flex-nowrap">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                    location === item.href
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: theme toggle */}
          <div className="shrink-0">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" data-testid="button-theme-toggle" className="h-8 w-8">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Dropdown nav for mobile/narrow */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-border/60 bg-background/95 px-4 py-3 flex flex-col gap-1">
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
