import { apiRequest, PROXY_BASE } from './queryClient'

// Check if running in static mode (GitHub Pages) or server mode (Express)
const IS_STATIC = PROXY_BASE === '' || PROXY_BASE === '__PORT_5000__'

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

  if (IS_STATIC) {
    const base = getDataBase()
    const url = `${base}/data/members-current.json`
    const resp = await fetch(url)
    const data = await resp.json()
    _currentMembersCache = Array.isArray(data) ? data : data.members || []
    return _currentMembersCache
  } else {
    const resp = await apiRequest('GET', '/api/members/compass')
    const data = await resp.json()
    _currentMembersCache = Array.isArray(data) ? data : data.members || []
    return _currentMembersCache
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
  // In static mode, return empty
  if (IS_STATIC) {
    return { votes: [], source: 'static' }
  }

  // In server mode, call the API
  const resp = await apiRequest('GET', `/api/members/${bioguideId}/votes`)
  const data = await resp.json()
  return { votes: data.votes || [], source: 'api' }
}

export async function getStats(): Promise<Stats> {
  if (IS_STATIC) {
    const base = getDataBase()
    const url = `${base}/data/stats.json`
    const resp = await fetch(url)
    return resp.json()
  } else {
    const resp = await apiRequest('GET', '/api/stats')
    return resp.json()
  }
}

export async function getRecentVotes(limit: number) {
  if (IS_STATIC) {
    return { votes: [] }
  } else {
    const resp = await apiRequest('GET', `/api/votes/recent?limit=${limit}`)
    return resp.json()
  }
}
