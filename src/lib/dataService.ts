import { apiRequest, PROXY_BASE } from './queryClient'

// Check if running in static mode (GitHub Pages) or server mode (Express)
// On GitHub Pages, PROXY_BASE will be empty
const IS_STATIC = PROXY_BASE === ''

// Fallback test data - enough to verify UI works
const TEST_MEMBERS: Member[] = [
  {
    bioguideId: 'B000944',
    displayName: 'Sherrod Brown',
    chamber: 'Senate',
    party: 'Democrat',
    state: 'OH',
    compassX: -0.5,
    compassY: -0.3,
    isCurrent: true,
    dim1: -0.5,
    dim2: -0.3,
    govtrackId: 400050,
  },
  {
    bioguideId: 'M000303',
    displayName: 'John McCain',
    chamber: 'Senate',
    party: 'Republican',
    state: 'AZ',
    compassX: 0.4,
    compassY: 0.2,
    isCurrent: false,
    dim1: 0.4,
    dim2: 0.2,
    govtrackId: 400255,
  },
  {
    bioguideId: 'P000197',
    displayName: 'Nancy Pelosi',
    chamber: 'House',
    party: 'Democrat',
    state: 'CA',
    district: '11',
    compassX: -0.6,
    compassY: -0.2,
    isCurrent: true,
    dim1: -0.6,
    dim2: -0.2,
    govtrackId: 400314,
  },
  {
    bioguideId: 'M001109',
    displayName: 'Marjorie Taylor Greene',
    chamber: 'House',
    party: 'Republican',
    state: 'GA',
    district: '14',
    compassX: 0.8,
    compassY: 0.7,
    isCurrent: true,
    dim1: 0.8,
    dim2: 0.7,
    govtrackId: 412690,
  },
]

function getDataBase() {
  return import.meta.env.BASE_URL.replace(/\/$/, '')
}

export interface Member {
  bioguideId: string
  displayName: string
  chamber: 'House' | 'Senate'
  party: string
  state: string
  district?: string
  compassX?: number
  compassY?: number
  isCurrent: boolean
  dim1?: number
  dim2?: number
  govtrackId?: number
}

export interface VoteRecord {
  voteDate: string
  question: string
  result: string
  option: string
}

export interface Stats {
  currentMembers: number
  currentSenators: number
  currentRepresentatives: number
  totalHistorical: number
}

let _currentMembersCache: Member[] | null = null

export async function getCurrentMembers(): Promise<Member[]> {
  if (_currentMembersCache) return _currentMembersCache

  try {
    // Fetch from Voteview API - gets current members with ideology scores
    console.log('Fetching members from Voteview API...')
    const resp = await fetch('https://voteviewdata.com/api/v1/members')
    console.log('Voteview response status:', resp.status)
    
    if (!resp.ok) {
      throw new Error(`Voteview API returned ${resp.status}`)
    }
    
    const data = await resp.json()
    console.log('Voteview data received, total items:', Array.isArray(data) ? data.length : 'not an array')
    
    // Filter for current senators and representatives (congress 119 = current)
    const members: Member[] = (data || [])
      .filter((m: any) => m.congress === 119 && (m.chamber === 'S' || m.chamber === 'H'))
      .map((m: any) => ({
        bioguideId: m.bioguide_id || m.id,
        displayName: `${m.firstname} ${m.lastname}`,
        chamber: m.chamber === 'S' ? 'Senate' : 'House',
        party: m.party === 100 ? 'Democrat' : m.party === 200 ? 'Republican' : 'Independent',
        state: m.state,
        district: m.district_code ? String(m.district_code) : undefined,
        compassX: m.nominate_dim1, // X-axis: economic
        compassY: m.nominate_dim2, // Y-axis: social
        isCurrent: true,
        dim1: m.nominate_dim1,
        dim2: m.nominate_dim2,
        govtrackId: m.govtrack_id,
      }))
    
    console.log('Filtered members:', members.length)
    _currentMembersCache = members
    return members
  } catch (e) {
    console.error('Error fetching from Voteview:', e)
    // Fallback to local JSON if Voteview fails
    try {
      console.log('Falling back to local JSON...')
      const base = getDataBase()
      const url = `${base}/data/members-current.json`
      console.log('Trying to load from:', url)
      const resp = await fetch(url)
      console.log('Local JSON response status:', resp.status)
      const data = await resp.json()
      _currentMembersCache = Array.isArray(data) ? data : data.members || []
      console.log('Loaded from local JSON:', _currentMembersCache.length)
      return _currentMembersCache
    } catch (e2) {
      console.error('Error loading fallback members data:', e2)
      console.log('Using test data as last resort')
      return TEST_MEMBERS
    }
  }
}

export async function getMember(bioguideId: string): Promise<Member | null> {
  const members = await getCurrentMembers()
  return members.find(m => m.bioguideId === bioguideId) || null
}

export async function searchMembers(params: {
  q?: string
  chamber?: string
  party?: string
  state?: string
  isCurrent?: boolean
  limit?: number
  offset?: number
}): Promise<{ members: Member[]; total: number }> {
  if (IS_STATIC) {
    const all = await getCurrentMembers()
    let results = all

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

    if (params.party) {
      results = results.filter(m => m.party === params.party)
    }

    if (params.state) {
      results = results.filter(m => m.state === params.state)
    }

    const offset = params.offset || 0
    const limit = params.limit || 50
    const paged = results.slice(offset, offset + limit)

    return { members: paged, total: results.length }
  } else {
    const p = new URLSearchParams()
    if (params.q) p.set('q', params.q)
    if (params.chamber) p.set('chamber', params.chamber)
    if (params.party) p.set('party', params.party)
    if (params.state) p.set('state', params.state)
    if (params.limit) p.set('limit', String(params.limit))
    if (params.offset) p.set('offset', String(params.offset))

    const resp = await apiRequest('GET', `/api/members?${p.toString()}`)
    return resp.json()
  }
}

export async function getMemberVotes(bioguideId: string, govtrackId?: number): Promise<{ votes: VoteRecord[]; source: string }> {
  try {
    // Always try to call GovTrack API directly (works from browser - CORS enabled)
    if (!IS_STATIC && !govtrackId) {
      // In server mode without govtrackId, try the server API
      const resp = await apiRequest('GET', `/api/members/${bioguideId}/votes`)
      const data = await resp.json()
      return { votes: data.votes || [], source: 'api' }
    }

    if (govtrackId) {
      // Fetch recent votes for this member from GovTrack
      const resp = await fetch(
        `https://www.govtrack.us/api/v2/person/${govtrackId}/votes?limit=20&order_by=-created`,
        { headers: { 'User-Agent': 'CongressWatch/1.0' } }
      )
      const data = await resp.json()
      
      const votes: VoteRecord[] = (data.objects || []).map((vote: any) => ({
        voteDate: vote.vote?.created?.split('T')[0] || '',
        question: vote.vote?.question || '',
        result: vote.vote?.result || '',
        option: vote.option || '',
      }))
      
      return { votes, source: 'govtrack' }
    }

    // Fallback: only in server mode
    if (!IS_STATIC) {
      const resp = await apiRequest('GET', `/api/members/${bioguideId}/votes`)
      const data = await resp.json()
      return { votes: data.votes || [], source: 'api' }
    }
    
    return { votes: [], source: 'no-data' }
  } catch (e) {
    console.error('Error fetching member votes:', e)
    return { votes: [], source: 'error' }
  }
}

export async function getStats(): Promise<Stats> {
  try {
    const members = await getCurrentMembers()
    const senators = members.filter(m => m.chamber === 'Senate').length
    const representatives = members.filter(m => m.chamber === 'House').length
    
    return {
      currentMembers: members.length,
      currentSenators: senators,
      currentRepresentatives: representatives,
      totalHistorical: 12000, // Approximate historical count
    }
  } catch (e) {
    console.error('Error calculating stats:', e)
    return {
      currentMembers: 0,
      currentSenators: 0,
      currentRepresentatives: 0,
      totalHistorical: 0,
    }
  }
}

export async function getRecentVotes(limit: number) {
  try {
    // Fetch recent votes from GovTrack
    const resp = await fetch(
      `https://www.govtrack.us/api/v2/vote?congress=119&limit=${limit}&order_by=-created`,
      { headers: { 'User-Agent': 'CongressWatch/1.0' } }
    )
    
    const data = await resp.json()
    
    const votes = (data.objects || []).map((vote: any) => ({
      voteDate: vote.created?.split('T')[0] || '',
      question: vote.question || '',
      result: vote.result || '',
      option: '',
    }))
    
    return { votes }
  } catch (e) {
    console.error('Error fetching recent votes:', e)
    // Fallback to server API if CORS fails (only in server mode)
    if (!IS_STATIC) {
      try {
        const resp = await apiRequest('GET', `/api/votes/recent?limit=${limit}`)
        return resp.json()
      } catch (e2) {
        return { votes: [] }
      }
    }
    return { votes: [] }
  }
}
