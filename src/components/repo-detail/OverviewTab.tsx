import { useQuery } from '@tanstack/react-query'
import { FaCodeBranch, FaStar } from 'react-icons/fa'
import { fetchBranches, type Branch, type RepoDetail as RepoDetailT } from '../../api/github'
import { getCachedPref, savePref } from '../../store/db'
import { KV, Surface } from './common'
import { branchCommitsTotal, fmtDate, pct, shortAgo } from './utils'

export function OverviewTab({ token, owner, name, data }: { token: string; owner: string; name: string; data: RepoDetailT }) {
  const ageDays = Math.max(1, (Date.now() - new Date(data.createdAt).getTime()) / 86_400_000)
  const totalCommits = branchCommitsTotal(data) ?? 0
  const commitsPerWeek = totalCommits > 0 ? ((totalCommits / ageDays) * 7).toFixed(1) : '0'

  return (
    <div className="rd-grid">
      <Surface title="Summary">
        <KV k="Default branch" v={data.defaultBranchRef?.name ?? '—'} />
        <KV k="Size on disk" v={data.diskUsage != null ? `${(data.diskUsage / 1024).toFixed(1)} MB` : '—'} />
        <KV k="License" v={data.licenseInfo?.name ?? '—'} />
        {data.homepageUrl && <KV k="Homepage" v={<a href={data.homepageUrl} target="_blank" rel="noreferrer">{data.homepageUrl}</a>} />}
        <KV k="Created" v={`${fmtDate(data.createdAt)} (${shortAgo(data.createdAt)})`} />
        <KV k="Last push" v={`${fmtDate(data.pushedAt)} (${shortAgo(data.pushedAt)})`} />
      </Surface>

      <Surface title="Activity">
        <KV k="Total commits" v={totalCommits.toLocaleString()} />
        <KV k="Commits / week" v={`${commitsPerWeek} avg since creation`} />
        <KV k={<><FaStar size={10} /> Stars</>} v={data.stargazerCount} />
        <KV k={<><FaCodeBranch size={10} /> Forks</>} v={data.forkCount} />
        <KV k="Watchers" v={data.watchers.totalCount} />
        <KV k="Mentionable users" v={data.mentionableUsers.totalCount} />
      </Surface>

      {data.languages.edges.length > 0 && (
        <Surface title="Languages" wide>
          <div className="rd-lang-bar">
            {data.languages.edges.map((e) => (
              <span
                key={e.node.name}
                className="rd-lang-seg"
                title={`${e.node.name} · ${pct(e.size, data.languages.totalSize)}`}
                style={{ width: pct(e.size, data.languages.totalSize), background: e.node.color ?? '#888' }}
              />
            ))}
          </div>
          <ul className="rd-lang-list">
            {data.languages.edges.map((e) => (
              <li key={e.node.name}>
                <span className="rd-lang-dot" style={{ background: e.node.color ?? '#888' }} />
                <span>{e.node.name}</span>
                <span className="muted">{pct(e.size, data.languages.totalSize)}</span>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <BranchesSurface token={token} owner={owner} name={name} defaultBranch={data.defaultBranchRef?.name ?? null} />
    </div>
  )
}

function BranchesSurface({ token, owner, name, defaultBranch }: { token: string; owner: string; name: string; defaultBranch: string | null }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['branches', owner, name],
    queryFn: async () => {
      // 15-min IndexedDB cache so revisiting the same repo doesn't re-fetch
      // the branch list every time.
      const key = `branches:${owner}/${name}`
      const cached = await getCachedPref<Branch[]>(key, 15 * 60 * 1000)
      if (cached) return cached
      const fresh = await fetchBranches(token, owner, name)
      await savePref(key, fresh)
      return fresh
    },
    staleTime: 5 * 60 * 1000
  })
  const branches: Branch[] = data ?? []
  const top = branches.slice(0, 10)

  return (
    <Surface title={`Branches${branches.length > 0 ? ` (${branches.length})` : ''}`}>
      {isLoading && <div className="hs-skeleton-bar" style={{ width: '70%' }} />}
      {error && <span className="muted">Failed to load branches.</span>}
      {!isLoading && !error && top.length === 0 && <span className="muted">No branches.</span>}
      {top.map((b) => {
        const isDefault = b.name === defaultBranch
        const author = b.target.author?.user?.login
        return (
          <div key={b.name} className="rd-branch">
            <FaCodeBranch size={11} className="rd-branch-icon" />
            <span className="rd-branch-name">
              {b.name}
              {isDefault && <span className="rd-tag">default</span>}
            </span>
            <span className="rd-branch-meta muted">
              {author ? `@${author} · ` : ''}{shortAgo(b.target.committedDate)}
            </span>
          </div>
        )
      })}
      {branches.length > top.length && (
        <div className="muted" style={{ fontSize: '0.8em', marginTop: 8 }}>
          + {branches.length - top.length} more
        </div>
      )}
    </Surface>
  )
}
