import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon, Menu, X, Map, HelpCircle, Users, Home, ScrollText, Info } from "lucide-react";
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
      <header className="z-50 border-b border-border/60 backdrop-blur-md bg-background/80" style={{overflow:"visible"}}>

        {/* ── Mobile header: compact bar, logo overflows, controls in bar ── */}
        <div className="min-[1100px]:hidden relative flex flex-col items-center" style={{height:"140px"}}>
          {/* Logo centered, overflows bar above and below */}
          <Link href="/" className="absolute" style={{top:"40%", transform:"translateY(-50%)", display:"block", width:"300px", zIndex:10}}>
            <img src="./civicism-logo.png" alt="Civicism logo" style={{width:"300px",height:"auto", display:"block", filter: theme === "dark" ? "brightness(0) saturate(100%) invert(90%) sepia(18%) saturate(400%) hue-rotate(163deg) brightness(103%) contrast(92%)" : "none"}} />
          </Link>
          {/* Controls pinned to bottom of bar */}
          <div className="absolute bottom-1 flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 min-[1100px]:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" data-testid="button-theme-toggle" className="h-8 w-8">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* ── Desktop header: logo left, nav center, toggle right ── */}
        <div className="hidden min-[1100px]:flex w-full pl-0 pr-4 items-center" style={{height:"120px"}}>
          <Link href="/" className="shrink-0 inline-flex items-center" style={{width:"300px", marginLeft:"8px", position:"relative", zIndex:10}}>
            <img src="./civicism-logo.png" alt="Civicism logo" style={{width:"300px",height:"auto",maxWidth:"none",objectFit:"contain", filter: theme === "dark" ? "brightness(0) saturate(100%) invert(90%) sepia(18%) saturate(400%) hue-rotate(163deg) brightness(103%) contrast(92%)" : "none"}} />
          </Link>
          <nav className="flex flex-1 items-center justify-center gap-0.5 flex-nowrap min-w-0" style={{marginLeft:"-200px", marginTop:"12px"}}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-2 py-3 rounded-md font-medium transition-colors whitespace-nowrap shrink text-[clamp(11px,1.1vw,14px)]",
                  location === item.href
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" data-testid="button-theme-toggle" className="h-8 w-8 shrink-0" style={{marginTop:"12px"}}>
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>

        {/* Dropdown nav for mobile/narrow */}
        {mobileOpen && (
          <div className="min-[1100px]:hidden border-t border-border/60 bg-background/95 px-4 py-3 flex flex-col gap-1">
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
