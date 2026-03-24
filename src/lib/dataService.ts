/**
 * Data service for fetching congressional member data and voting records.
 * Primary sources: Voteview API (ideology scores) and GovTrack API (voting records)
 */

export interface Member {
  bioguideId: string
  displayName: string
  chamber: 'House' | 'Senate'
  party: string
  state: string
  district?: string
  // Ideology scores (NOMINATE dimensions)
  dim1?: number // Economic liberty: -1 (state control) to +1 (free market)
  dim2?: number // Social liberty: -1 (restrictions) to +1 (civil liberties)
  compassX?: number // Alias for dim1
  compassY?: number // Alias for dim2
  isCurrent: boolean
  govtrackId?: number
  photoUrl?: string
}

export interface VoteRecord {
  voteId: string
  voteDate: string
  question: string
  result: string
  memberOption: string // How this member voted
  description: string
}

export interface Stats {
  currentMembers: number
  currentSenators: number
  currentRepresentatives: number
  totalHistorical: number
}

interface VoteviewMember {
  bioguide_id: string
  firstname: string
  lastname: string
  chamber: 'H' | 'S'
  party: number // 100=D, 200=R
  state: string
  district_code?: number
  nominate_dim1: number
  nominate_dim2: number
  congress: number
  govtrack_id?: number
}

let membersCache: Member[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

function isCacheValid() {
  return membersCache && Date.now() - cacheTimestamp < CACHE_DURATION
}

/**
 * Fetch current members from Voteview API
 * Includes ideology scores (NOMINATE dimensions)
 */
export async function getCurrentMembers(): Promise<Member[]> {
  if (isCacheValid()) return membersCache!

  try {
    console.log('[DataService] Fetching members from Voteview API...')
    const resp = await fetch('https://voteviewdata.com/api/v1/members')
    
    if (!resp.ok) {
      throw new Error(`Voteview API error: ${resp.status}`)
    }

    const voteviewMembers: VoteviewMember[] = await resp.json()
    console.log(`[DataService] Received ${voteviewMembers.length} members from Voteview`)

    // Filter for current Congress (119) senators and representatives
    const members: Member[] = voteviewMembers
      .filter(m => m.congress === 119 && (m.chamber === 'S' || m.chamber === 'H'))
      .map(m => ({
        bioguideId: m.bioguide_id,
        displayName: `${m.firstname} ${m.lastname}`,
        chamber: m.chamber === 'S' ? 'Senate' : 'House',
        party: m.party === 100 ? 'Democrat' : m.party === 200 ? 'Republican' : 'Independent',
        state: m.state,
        district: m.district_code ? String(m.district_code) : undefined,
        dim1: m.nominate_dim1, // Economic liberty
        dim2: m.nominate_dim2, // Social liberty
        compassX: m.nominate_dim1,
        compassY: m.nominate_dim2,
        isCurrent: true,
        govtrackId: m.govtrack_id,
      }))

    membersCache = members
    cacheTimestamp = Date.now()
    console.log(`[DataService] Cached ${members.length} current members`)
    return members
  } catch (e) {
    console.error('[DataService] Error fetching members from Voteview:', e)
    throw e
  }
}

/**
 * Get a single member by bioguide ID
 */
export async function getMember(bioguideId: string): Promise<Member | null> {
  try {
    const members = await getCurrentMembers()
    return members.find(m => m.bioguideId === bioguideId) || null
  } catch (e) {
    console.error(`[DataService] Error getting member ${bioguideId}:`, e)
    return null
  }
}

/**
 * Search members with filters
 */
export async function searchMembers(params: {
  q?: string
  chamber?: string
  party?: string
  state?: string
  limit?: number
  offset?: number
}): Promise<{ members: Member[]; total: number }> {
  try {
    const members = await getCurrentMembers()
    let results = [...members]

    if (params.q) {
      const q = params.q.toLowerCase()
      results = results.filter(m =>
        m.displayName.toLowerCase().includes(q) ||
        m.bioguideId.toLowerCase().includes(q) ||
        m.state.toLowerCase().includes(q)
      )
    }

    if (params.chamber && params.chamber !== 'all') {
      results = results.filter(m => m.chamber === params.chamber)
    }

    if (params.party && params.party !== 'all') {
      results = results.filter(m => m.party === params.party)
    }

    if (params.state && params.state !== 'all') {
      results = results.filter(m => m.state === params.state)
    }

    const offset = params.offset || 0
    const limit = params.limit || 50
    const paged = results.slice(offset, offset + limit)

    return { members: paged, total: results.length }
  } catch (e) {
    console.error('[DataService] Error searching members:', e)
    return { members: [], total: 0 }
  }
}

/**
 * Fetch recent votes from GovTrack API
 */
export async function getRecentVotes(limit: number = 10): Promise<{ votes: VoteRecord[] }> {
  try {
    console.log(`[DataService] Fetching ${limit} recent votes from GovTrack...`)
    const resp = await fetch(
      `https://www.govtrack.us/api/v2/vote?congress=119&limit=${limit}&order_by=-created`,
      { headers: { 'User-Agent': 'CongressWatch/1.0' } }
    )

    if (!resp.ok) {
      throw new Error(`GovTrack API error: ${resp.status}`)
    }

    const data = await resp.json()
    const votes: VoteRecord[] = (data.objects || []).map((vote: any) => ({
      voteId: String(vote.id),
      voteDate: vote.created?.split('T')[0] || '',
      question: vote.question || '',
      result: vote.result || '',
      memberOption: '',
      description: vote.question || '',
    }))

    console.log(`[DataService] Fetched ${votes.length} recent votes`)
    return { votes }
  } catch (e) {
    console.error('[DataService] Error fetching recent votes:', e)
    return { votes: [] }
  }
}

/**
 * Fetch member's voting record from GovTrack API
 */
export async function getMemberVotes(
  bioguideId: string,
  govtrackId?: number
): Promise<{ votes: VoteRecord[] }> {
  try {
    // If we don't have govtrackId, try to get it
    if (!govtrackId) {
      const member = await getMember(bioguideId)
      govtrackId = member?.govtrackId
    }

    if (!govtrackId) {
      console.warn(`[DataService] No govtrackId for member ${bioguideId}`)
      return { votes: [] }
    }

    console.log(`[DataService] Fetching votes for member ${bioguideId} (govtrackId=${govtrackId})...`)
    const resp = await fetch(
      `https://www.govtrack.us/api/v2/person/${govtrackId}/votes?limit=20&order_by=-created`,
      { headers: { 'User-Agent': 'CongressWatch/1.0' } }
    )

    if (!resp.ok) {
      throw new Error(`GovTrack API error: ${resp.status}`)
    }

    const data = await resp.json()
    const votes: VoteRecord[] = (data.objects || []).map((vote: any) => ({
      voteId: String(vote.vote?.id || ''),
      voteDate: vote.vote?.created?.split('T')[0] || '',
      question: vote.vote?.question || '',
      result: vote.vote?.result || '',
      memberOption: vote.option || '',
      description: vote.vote?.question || '',
    }))

    console.log(`[DataService] Fetched ${votes.length} votes for member`)
    return { votes }
  } catch (e) {
    console.error(`[DataService] Error fetching member votes:`, e)
    return { votes: [] }
  }
}

/**
 * Calculate statistics
 */
export async function getStats(): Promise<Stats> {
  try {
    const members = await getCurrentMembers()
    const senators = members.filter(m => m.chamber === 'Senate')
    const representatives = members.filter(m => m.chamber === 'House')

    return {
      currentMembers: members.length,
      currentSenators: senators.length,
      currentRepresentatives: representatives.length,
      totalHistorical: 12000,
    }
  } catch (e) {
    console.error('[DataService] Error calculating stats:', e)
    return {
      currentMembers: 0,
      currentSenators: 0,
      currentRepresentatives: 0,
      totalHistorical: 0,
    }
  }
}
