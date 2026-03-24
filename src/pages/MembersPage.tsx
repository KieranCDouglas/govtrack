import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchMembers, Member } from '@/lib/dataService'
import { Link } from 'react-router-dom'

const LIMIT = 50

export default function MembersPage() {
  const [searchParams, setSearchParams] = useState({
    q: '',
    chamber: 'all' as 'all' | 'Senate' | 'House',
    party: '',
  })
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['members-search', searchParams, page],
    queryFn: () =>
      searchMembers({
        q: searchParams.q || undefined,
        chamber: searchParams.chamber === 'all' ? undefined : searchParams.chamber,
        party: searchParams.party || undefined,
        limit: LIMIT,
        offset: page * LIMIT,
      }),
  })

  const members = data?.members || []
  const total = data?.total || 0

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Browse Members of Congress</h1>

      {/* Filters */}
      <div className="bg-card border border-border p-6 rounded-lg mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search</label>
            <input
              type="text"
              placeholder="Name or state..."
              value={searchParams.q}
              onChange={e => {
                setSearchParams({ ...searchParams, q: e.target.value })
                setPage(0)
              }}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Chamber</label>
            <select
              value={searchParams.chamber}
              onChange={e => {
                setSearchParams({ ...searchParams, chamber: e.target.value as any })
                setPage(0)
              }}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg"
            >
              <option value="all">All</option>
              <option value="Senate">Senate</option>
              <option value="House">House</option>
            </select>
          </div>
        </div>
      </div>

      {/* Member List */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading members...</p>
      ) : members.length === 0 ? (
        <p className="text-muted-foreground">No members found.</p>
      ) : (
        <>
          <div className="space-y-2 mb-6">
            {members.map((m: Member) => (
              <Link
                key={m.bioguideId}
                to={`/members/${m.bioguideId}`}
                className="block p-4 bg-card border border-border rounded-lg hover:border-primary transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{m.displayName}</div>
                    <div className="text-sm text-muted-foreground">
                      {m.chamber === 'Senate' ? 'Senator' : 'Representative'} from {m.state}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${m.party === 'Democrat' ? 'text-blue-400' : m.party === 'Republican' ? 'text-red-400' : 'text-green-400'}`}>
                      {m.party}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 bg-secondary disabled:opacity-50 rounded-lg"
            >
              Previous
            </button>
            <span className="text-muted-foreground">
              Page {page + 1} of {Math.ceil(total / LIMIT)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * LIMIT >= total}
              className="px-4 py-2 bg-secondary disabled:opacity-50 rounded-lg"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
