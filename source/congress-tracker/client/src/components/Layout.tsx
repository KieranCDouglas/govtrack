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
      <header className="sticky top-0 z-50 border-b border-border/60 backdrop-blur-md bg-background/80 overflow-hidden">

        {/* ── Mobile / narrow header (hamburger) ── */}
        <div className="lg:hidden">
          {/* Logo row */}
          <div className="flex items-center justify-between px-3" style={{height:"120px"}}>
            <div className="w-16 shrink-0" />
            <Link href="/" className="flex-1 flex justify-center overflow-hidden">
              <img src="./civicism-logo.png" alt="Civicism logo" style={{height:"clamp(180px, 38vw, 450px)",width:"auto",maxWidth:"calc(100vw - 8rem)",objectFit:"contain",marginTop:"clamp(-165px, calc((38vw - 120px) / -2), -30px)",marginBottom:"clamp(-165px, calc((38vw - 120px) / -2), -30px)"}} />
            </Link>
            <div className="w-16 shrink-0 flex justify-end items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" data-testid="button-theme-toggle" className="h-8 w-8">
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
                {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Desktop header (wide enough to fit all nav items) ── */}
        <div className="hidden lg:flex max-w-7xl mx-auto px-4 items-center justify-between gap-4" style={{height:"130px"}}>
          <Link href="/">
            <img src="./civicism-logo.png" alt="Civicism logo" style={{height:"clamp(220px, 22vw, 340px)",width:"auto",objectFit:"contain",marginTop:"-105px",marginBottom:"-105px"}} />
          </Link>
          <nav className="flex items-center gap-1 flex-nowrap">
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" data-testid="button-theme-toggle" className="h-8 w-8">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Hamburger nav dropdown (mobile + narrow desktop) */}
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
