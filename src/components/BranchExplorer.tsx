import { useEffect, useMemo, useState } from 'react'
import { fetchBranches, type Branch } from '../api/github'
import { FadeIn, Skeleton, Badge, Button } from './ui'

type Props = {
  token: string
  owner: string
  name: string
  defaultBranch?: string
  onCompare?: (base: string, head: string) => void
}

export function BranchExplorer({ token, owner, name, defaultBranch, onCompare }: Props) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [filter, setFilter] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date')
  const [showCompare, setShowCompare] = useState(false)
  const [compareBase, setCompareBase] = useState('')
  const [compareHead, setCompareHead] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    
    ;(async () => {
      try {
        const data = await fetchBranches(token, owner, name)
        if (!cancelled) setBranches(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    
    return () => { cancelled = true }
  }, [token, owner, name])

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim()
    let result = branches
    
    if (q) {
      result = result.filter(b => b.name.toLowerCase().includes(q))
    }
    
    if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    }
    
    return result
  }, [branches, filter, sortBy])

  const grouped = useMemo(() => {
    const main = defaultBranch || 'main'
    const groups = {
      default: [] as Branch[],
      protected: [] as Branch[],
      feature: [] as Branch[],
      release: [] as Branch[],
      other: [] as Branch[]
    }
    
    for (const b of filtered) {
      const n = b.name
      if (n === main || n === 'master') {
        groups.default.push(b)
      } else if (n.startsWith('release/') || n.startsWith('v') && /^\d/.test(n.slice(1))) {
        groups.release.push(b)
      } else if (n.startsWith('feature/') || n.startsWith('feat/') || n.startsWith('feature-')) {
        groups.feature.push(b)
      } else if (n === 'main' || n === 'master' || n.startsWith('release/')) {
        groups.protected.push(b)
      } else {
        groups.other.push(b)
      }
    }
    
    return groups
  }, [filtered, defaultBranch])

  const handleCompare = () => {
    if (compareBase && compareHead && onCompare) {
      onCompare(compareBase, compareHead)
    }
  }

  const recent = useMemo(() => {
    return [...filtered]
      .sort((a, b) => new Date(b.target.committedDate).getTime() - new Date(a.target.committedDate).getTime())
      .slice(0, 10)
  }, [filtered])

  if (error) {
    return (
      <div className="branch-explorer">
        <div className="error-inline">{error}</div>
      </div>
    )
  }

  return (
    <FadeIn>
      <div className="branch-explorer">
        <div className="branch-header">
          <div className="branch-title">
            <h3>Branches</h3>
            <Badge>{branches.length}</Badge>
          </div>
          
          <div className="branch-controls">
            <input
              type="search"
              placeholder="Filter branches..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="branch-search"
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}>
              <option value="date">Recent first</option>
              <option value="name">Alphabetical</option>
            </select>
            <Button variant="ghost" size="sm" onClick={() => setShowCompare(!showCompare)}>
              Compare
            </Button>
          </div>
        </div>

        {showCompare && (
          <div className="branch-compare">
            <div className="compare-selects">
              <select value={compareBase} onChange={(e) => setCompareBase(e.target.value)}>
                <option value="">Base branch...</option>
                {branches.map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
              <span className="compare-arrow">←→</span>
              <select value={compareHead} onChange={(e) => setCompareHead(e.target.value)}>
                <option value="">Head branch...</option>
                {branches.map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleCompare} disabled={!compareBase || !compareHead}>
                Open Compare
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="branch-skeleton">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height={48} />
            ))}
          </div>
        ) : (
          <>
            <div className="branch-groups">
              {grouped.default.length > 0 && (
                <div className="branch-group">
                  <h4 className="branch-group-title">Default</h4>
                  <div className="branch-list">
                    {grouped.default.map(b => (
                      <BranchCard key={b.name} branch={b} isDefault />
                    ))}
                  </div>
                </div>
              )}
              
              {grouped.release.length > 0 && (
                <div className="branch-group">
                  <h4 className="branch-group-title">Release</h4>
                  <div className="branch-list">
                    {grouped.release.map(b => (
                      <BranchCard key={b.name} branch={b} />
                    ))}
                  </div>
                </div>
              )}
              
              {grouped.feature.length > 0 && (
                <div className="branch-group">
                  <h4 className="branch-group-title">Feature</h4>
                  <div className="branch-list">
                    {grouped.feature.map(b => (
                      <BranchCard key={b.name} branch={b} />
                    ))}
                  </div>
                </div>
              )}
              
              {grouped.other.length > 0 && (
                <div className="branch-group">
                  <h4 className="branch-group-title">All branches ({grouped.other.length})</h4>
                  <div className="branch-list">
                    {grouped.other.map(b => (
                      <BranchCard key={b.name} branch={b} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="branch-recent">
              <h4 className="branch-group-title">Recently updated</h4>
              <div className="branch-list">
                {recent.map(b => (
                  <BranchCard key={b.name} branch={b} compact />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </FadeIn>
  )
}

function BranchCard({
  branch,
  isDefault,
  compact
}: {
  branch: Branch
  isDefault?: boolean
  compact?: boolean
}) {
  return (
    <div className={`branch-card ${isDefault ? 'default' : ''} ${compact ? 'compact' : ''}`}>
      <div className="branch-card-header">
        <span className="ci-state">○</span>
        <span className="branch-name">{branch.name}</span>
        {isDefault && <Badge variant="info">default</Badge>}
      </div>
      {!compact && (
        <div className="branch-card-meta">
          <span className="branch-committer">
            <span>{branch.target.author?.user?.login || 'unknown'}</span>
          </span>
          <span className="branch-time">{timeAgo(branch.target.committedDate)}</span>
        </div>
      )}
      {!compact && branch.target.messageHeadline && (
        <div className="branch-message">{branch.target.messageHeadline}</div>
      )}
    </div>
  )
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(day / 365)}y`
}