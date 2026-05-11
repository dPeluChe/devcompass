import type { Repo } from '../../api/github'
import { FaPython, FaJs, FaJava, FaVuejs, FaReact, FaAngular, FaNode, FaDatabase, FaLock, FaCodeBranch, FaExclamationCircle, FaStar, FaExclamation, FaCheck } from 'react-icons/fa'
import { SiTypescript, SiGo, SiRust, SiMysql, SiMongodb } from 'react-icons/si'
import { VscJson, VscSymbolMisc } from 'react-icons/vsc'

type IconType = typeof FaPython

function getLangIcon(name: string): IconType | null {
  const key = name?.toLowerCase() ?? ''
  const icons: Record<string, IconType> = {
    python: FaPython,
    javascript: FaJs,
    typescript: SiTypescript,
    java: FaJava,
    go: SiGo,
    rust: SiRust,
    docker: FaDatabase,
    vue: FaVuejs,
    react: FaReact,
    angular: FaAngular,
    nodejs: FaNode,
    sql: FaDatabase,
    postgresql: SiMysql,
    mysql: SiMysql,
    mongodb: SiMongodb,
    swift: FaNode,
    shell: FaNode,
    yaml: VscSymbolMisc,
    json: VscJson,
  }
  return icons[key] ?? null
}

export type RepoSignal = {
  level: 'critical' | 'attention' | 'active' | 'quiet'
  reasons: string[]
  activityLabel: string
}

export function repoSignal(repo: Repo, pinned: boolean): RepoSignal {
  const reasons: string[] = []
  let score = 0

  if (pinned) { score += 20; reasons.push('pinned') }
  if (repo.openPRs.totalCount > 0) {
    score += 40 + Math.min(repo.openPRs.totalCount, 5) * 4
    reasons.push(`${repo.openPRs.totalCount} open PR${repo.openPRs.totalCount > 1 ? 's' : ''}`)
  }
  if (repo.openIssues.totalCount > 0) {
    score += Math.min(repo.openIssues.totalCount, 10)
    reasons.push(`${repo.openIssues.totalCount} open issue${repo.openIssues.totalCount > 1 ? 's' : ''}`)
  }

  const daysSincePush = (Date.now() - new Date(repo.pushedAt).getTime()) / 86_400_000
  if (daysSincePush <= 7) { score += 10; reasons.push('recent commit') }
  else if (pinned && daysSincePush > 90) { score += 12; reasons.push('pinned but stale') }
  if (repo.isFork) reasons.push('fork')

  const activityLabel = activityFor(daysSincePush)

  if (repo.isArchived) return { level: 'quiet', reasons: ['archived'], activityLabel }
  if (score >= 60) return { level: 'critical', reasons, activityLabel }
  if (score >= 25) return { level: 'attention', reasons, activityLabel }
  if (daysSincePush <= 7) return { level: 'active', reasons: reasons.length ? reasons : ['recent commit'], activityLabel }
  return { level: 'quiet', reasons: reasons.length ? reasons : ['no immediate signal'], activityLabel }
}

function StatusIcon({ level }: { level: RepoSignal['level'] }) {
  if (level === 'critical' || level === 'attention') return <FaExclamation size={9} />
  if (level === 'active') return <FaCheck size={9} />
  return null
}

function activityFor(days: number): string {
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 7) return `${Math.floor(days)}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

type Props = {
  repo: Repo
  pinned?: boolean
  onTogglePinned?: () => void
  onSelect: () => void
}

export function RepoCard({ repo, pinned = false, onTogglePinned, onSelect }: Props) {
  const langKey = repo.primaryLanguage?.name?.toLowerCase() ?? ''
  const LangIcon = langKey ? getLangIcon(langKey) : null
  const isJS = langKey === 'javascript'
  const isTS = langKey === 'typescript'
  const signal = repoSignal(repo, pinned)

  return (
    <article
      className={`card signal-${signal.level} ${repo.isArchived ? 'archived' : ''} ${pinned ? 'pinned' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <header>
        <span className="title">{repo.name}</span>
        <span className="badges">
          <span className={`op-status status-${signal.level}`} title={signal.reasons.join(' · ')}>
            <StatusIcon level={signal.level} />
          </span>
          {onTogglePinned && (
            <button
              className={`pin-btn ${pinned ? 'active' : ''}`}
              title={pinned ? 'Unpin repo' : 'Pin repo'}
              onClick={(e) => {
                e.stopPropagation()
                onTogglePinned()
              }}
            >
              <FaStar size={11} />
            </button>
          )}
          {repo.isPrivate && <span className="badge" title="Private"><FaLock size={10} /></span>}
          {repo.isFork && <span className="badge" title="Forked"><FaCodeBranch size={10} /></span>}
          {repo.isArchived && <span className="badge" title="Archived"><FaExclamationCircle size={10} /></span>}
          {isJS && <span className="badge" title="JavaScript">JS</span>}
          {isTS && <span className="badge" title="TypeScript">TS</span>}
          {LangIcon && !isJS && !isTS && <span className="badge" title={repo.primaryLanguage?.name}><LangIcon size={10} color={repo.primaryLanguage?.color ?? '#888'} /></span>}
        </span>
      </header>
      <p className="owner muted">{repo.owner.login}</p>
      {repo.description && <p className="desc">{repo.description}</p>}
      <footer>
        {repo.defaultBranchRef && (
          <span className="meta" title={`Branch: ${repo.defaultBranchRef.name}`}>
            <FaCodeBranch size={10} /> {repo.defaultBranchRef.name}
          </span>
        )}
        {repo.openPRs.totalCount > 0 && (
          <span className="meta" title="Open PRs">⚡{repo.openPRs.totalCount} PR{repo.openPRs.totalCount > 1 ? 's' : ''}</span>
        )}
        <span className="muted" title={repo.pushedAt}>{signal.activityLabel}</span>
        {repo.stargazerCount > 0 && <span title="Stars">★{repo.stargazerCount}</span>}
        {repo.openIssues.totalCount > 0 && <span title="Open issues" className="issues">◎{repo.openIssues.totalCount}</span>}
      </footer>
    </article>
  )
}
