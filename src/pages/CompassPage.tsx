import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentMembers, Member } from '@/lib/dataService'
import MiniCompass from '@/components/MiniCompass'

export default function CompassPage() {
  const [chamber, setChamber] = useState<'all' | 'Senate' | 'House'>('all')

  const { data: allMembers, isLoading } = useQuery({
    queryKey: ['compass-members', chamber],
    queryFn: async () => {
      const all = await getCurrentMembers()
      return chamber === 'all' ? all : all.filter(m => m.chamber === chamber)
    },
  })

  const members = allMembers || []

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Political Compass</h1>

      <div className="mb-6">
        <label className="mr-4">Chamber:</label>
        <select
          value={chamber}
          onChange={e => setChamber(e.target.value as any)}
          className="px-3 py-2 bg-background border border-input rounded-lg"
        >
          <option value="all">All</option>
          <option value="Senate">Senate Only</option>
          <option value="House">House Only</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading compass data...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <svg viewBox="0 0 600 600" className="w-full border border-border rounded-lg bg-card">
              {/* Quadrant backgrounds */}
              <rect x="0" y="0" width="300" height="300" fill="rgba(34,197,94,0.1)" />
              <rect x="300" y="0" width="300" height="300" fill="rgba(59,130,246,0.1)" />
              <rect x="0" y="300" width="300" height="300" fill="rgba(168,85,247,0.1)" />
              <rect x="300" y="300" width="300" height="300" fill="rgba(239,68,68,0.1)" />

              {/* Axes */}
              <line x1="300" y1="0" x2="300" y2="600" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <line x1="0" y1="300" x2="600" y2="300" stroke="currentColor" strokeWidth="2" opacity="0.3" />

              {/* Axis labels */}
              <text x="20" y="310" fontSize="12" fill="currentColor" opacity="0.6">
                ← State-Directed
              </text>
              <text x="480" y="310" fontSize="12" fill="currentColor" opacity="0.6" textAnchor="end">
                Free Market →
              </text>
              <text x="305" y="20" fontSize="12" fill="currentColor" opacity="0.6">
                ↑ Progressive
              </text>
              <text x="305" y="590" fontSize="12" fill="currentColor" opacity="0.6">
                ↓ Traditional
              </text>

              {/* Member dots */}
              {members
                .filter(m => m.compassX !== undefined && m.compassY !== undefined)
                .map(m => {
                  const x = 300 + (m.compassX || 0) * 250
                  const y = 300 - (m.compassY || 0) * 250
                  const color =
                    m.party === 'Democrat' ? '#3b82f6' : m.party === 'Republican' ? '#ef4444' : '#22c55e'

                  return (
                    <circle
                      key={m.bioguideId}
                      cx={x}
                      cy={y}
                      r="4"
                      fill={color}
                      opacity="0.7"
                      className="hover:r-6 transition-all"
                    />
                  )
                })}
            </svg>
          </div>

          {/* Legend */}
          <div className="space-y-4">
            <div className="bg-card border border-border p-4 rounded-lg">
              <h3 className="font-bold mb-3">Party Distribution</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full" />
                  <span>Democrats: {members.filter(m => m.party === 'Democrat').length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full" />
                  <span>Republicans: {members.filter(m => m.party === 'Republican').length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full" />
                  <span>Other: {members.filter(m => m.party !== 'Democrat' && m.party !== 'Republican').length}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border p-4 rounded-lg">
              <h3 className="font-bold mb-3">Quadrants</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <div className="font-semibold text-green-400">↖ Progressive-Left</div>
                  <p className="text-muted-foreground">State-directed + Progressive</p>
                </div>
                <div>
                  <div className="font-semibold text-blue-400">↗ Progressive-Right</div>
                  <p className="text-muted-foreground">Free market + Progressive</p>
                </div>
                <div>
                  <div className="font-semibold text-purple-400">↙ Traditional-Left</div>
                  <p className="text-muted-foreground">State-directed + Traditional</p>
                </div>
                <div>
                  <div className="font-semibold text-red-400">↘ Traditional-Right</div>
                  <p className="text-muted-foreground">Free market + Traditional</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
