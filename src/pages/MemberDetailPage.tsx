import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMember, getMemberVotes } from '@/lib/dataService'
import MiniCompass from '@/components/MiniCompass'

export default function MemberDetailPage() {
  const { bioguideId } = useParams<{ bioguideId: string }>()

  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ['member', bioguideId],
    queryFn: async () => {
      const m = await getMember(bioguideId!)
      return m
    },
    enabled: !!bioguideId,
  })

  const { data: votesData, isLoading: votesLoading } = useQuery({
    queryKey: ['member-votes', bioguideId],
    queryFn: () => getMemberVotes(bioguideId!, member?.govtrackId),
    enabled: !!member,
  })

  if (memberLoading) return <p className="text-muted-foreground">Loading member...</p>
  if (!member) return <p className="text-muted-foreground">Member not found.</p>

  const votes = votesData?.votes || []

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <h1 className="text-4xl font-bold mb-2">{member.displayName}</h1>
          <p className="text-lg text-muted-foreground mb-6">
            {member.chamber === 'Senate' ? 'Senator' : 'Representative'} from {member.state}
          </p>

          <div className="space-y-3 text-sm mb-6">
            <div>
              <span className="font-semibold">Party:</span>{' '}
              <span
                className={
                  member.party === 'Democrat'
                    ? 'text-blue-400'
                    : member.party === 'Republican'
                      ? 'text-red-400'
                      : 'text-green-400'
                }
              >
                {member.party}
              </span>
            </div>
            {member.dim1 !== undefined && (
              <div>
                <span className="font-semibold">Economic Axis (Econ Left ← → Econ Right):</span>{' '}
                {(member.dim1 || 0).toFixed(3)}
              </div>
            )}
            {member.dim2 !== undefined && (
              <div>
                <span className="font-semibold">Social Axis (Progressive ← → Traditional):</span>{' '}
                {(member.dim2 || 0).toFixed(3)}
              </div>
            )}
          </div>
        </div>

        {member.compassX !== undefined && member.compassY !== undefined && (
          <div>
            <h3 className="font-bold mb-3">Political Position</h3>
            <MiniCompass
              compassX={member.compassX}
              compassY={member.compassY}
              name={member.displayName}
              party={member.party}
            />
          </div>
        )}
      </div>

      {votes.length > 0 && (
        <div className="bg-card border border-border p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Recent Votes</h2>
          <div className="space-y-3">
            {votes.slice(0, 10).map((vote, i) => (
              <div key={i} className="p-3 bg-background rounded-lg text-sm">
                <div className="font-semibold">{vote.question}</div>
                <div className="text-muted-foreground text-xs">{vote.voteDate}</div>
                <div className="mt-1">
                  Vote: <span className="font-semibold">{vote.option}</span> (Result: {vote.result})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
