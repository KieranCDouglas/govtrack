import { Link, useLocation } from 'react-router-dom'

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg hover:opacity-80">
            CongressWatch
          </Link>
          <div className="flex gap-6">
            <Link
              to="/members"
              className={isActive('/members') ? 'text-primary' : 'hover:text-primary'}
            >
              Members
            </Link>
            <Link
              to="/compass"
              className={isActive('/compass') ? 'text-primary' : 'hover:text-primary'}
            >
              Compass
            </Link>
            <Link
              to="/quiz"
              className={isActive('/quiz') ? 'text-primary' : 'hover:text-primary'}
            >
              Quiz
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-muted-foreground">
          <p>Data from <a href="https://www.govtrack.us" className="text-primary hover:underline">GovTrack.us</a> and <a href="https://voteview.com" className="text-primary hover:underline">Voteview</a></p>
        </div>
      </footer>
    </div>
  )
}
