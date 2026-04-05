import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import PerplexityAttribution from "@/components/PerplexityAttribution";
import { Sun, Moon, Map, HelpCircle, Users, Home, ScrollText } from "lucide-react";
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
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 backdrop-blur-md bg-background/80">
        {/* Single row: logo left, nav center/right, theme toggle right */}
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <img src="./logo.png" alt="Civicism logo" style={{height:"36px",width:"auto"}} />
          </Link>

          {/* Nav — icon-only on all screen sizes */}
          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "p-2 rounded-md transition-colors",
                  location === item.href
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <item.icon className="w-5 h-5" />
              </Link>
            ))}
          </nav>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            data-testid="button-theme-toggle"
            className="h-8 w-8 flex-shrink-0"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
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
