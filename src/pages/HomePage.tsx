import { useQuery } from '@tanstack/react-query'
import { getStats } from '@/lib/dataService'
import { Link } from 'react-router-dom'

export default function HomePage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => getStats(),
  })

  return (
    <div>
      <section className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Congress Voting Record Tracker</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Track every vote by every member of Congress. Compare your political ideology with members using our interactive compass.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/members" className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
            Browse Members
          </Link>
          <Link to="/quiz" className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90">
            Take the Quiz
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {isLoading ? (
          <p className="text-muted-foreground">Loading stats...</p>
        ) : stats ? (
          <>
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="text-3xl font-bold text-primary">{stats.currentMembers}</div>
              <div className="text-muted-foreground">Current Members</div>
            </div>
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="text-3xl font-bold text-accent">{stats.totalHistorical}</div>
              <div className="text-muted-foreground">Historical Members</div>
            </div>
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="text-3xl font-bold text-blue-400">2-Axis</div>
              <div className="text-muted-foreground">Political Compass</div>
            </div>
          </>
        ) : null}
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">About This Tool</h2>
        <div className="bg-card border border-border p-6 rounded-lg space-y-3 text-muted-foreground">
          <p>
            This interactive tracker lets you explore the voting records and ideological positions of every current and historical member of Congress.
          </p>
          <p>
            Members are placed on a <strong>2-axis political compass</strong> based on their voting patterns (from Voteview's NOMINATE scores):
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>X-Axis (Horizontal):</strong> Economic orientation (Left = State-Directed, Right = Free Market)</li>
            <li><strong>Y-Axis (Vertical):</strong> Social orientation (Bottom = Progressive, Top = Traditional)</li>
          </ul>
          <p>
            The compass places you on the same chart, so you can see which members' ideologies align most closely with yours.
          </p>
        </div>
      </section>
    </div>
  )
}
