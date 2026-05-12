import type { RepoDetail as RepoDetailT } from '../../api/github'
import { OrgChip } from '../home/OrgChip'
import {
  FaCheck,
  FaCodeBranch,
  FaExclamation,
  FaExclamationCircle,
  FaLock,
  FaLockOpen,
  FaStar
} from 'react-icons/fa'
import { ciClass, shortAgo, statusCheck } from './utils'

type Props = { owner: string; name: string; data: RepoDetailT | null; onClose: () => void }

export function RdHeader({ owner, name, data, onClose }: Props) {
  const ci = data ? statusCheck(data) : null
  return (
    <header className="rd-head">
      <div className="rd-head-main">
        <div className="rd-head-id">
          <OrgChip login={owner} avatarUrl={data?.owner.avatarUrl} size={28} />
          <div className="rd-head-titles">
            <h1 className="rd-title">
              <a className="muted" href={data?.owner.url ?? `https://github.com/${owner}`} target="_blank" rel="noreferrer">{owner}</a>
              <span className="rd-sep">/</span>
              <span>{name}</span>
            </h1>
            {data?.description && <p className="rd-desc">{data.description}</p>}
          </div>
        </div>
        <div className="rd-head-actions">
          {data && (
            <a className="rd-btn" href={data.url} target="_blank" rel="noreferrer" title="Open in GitHub">
              Open in GitHub ↗
            </a>
          )}
          <button className="rd-btn rd-btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>

      {data && (
        <div className="rd-head-meta">
          <span className="rd-pill" title={data.isPrivate ? 'Private repo' : 'Public repo'}>
            {data.isPrivate ? <FaLock size={9} /> : <FaLockOpen size={9} />}
            {data.isPrivate ? 'Private' : 'Public'}
          </span>
          {data.isArchived && (
            <span className="rd-pill rd-pill-warn" title="Archived"><FaExclamationCircle size={9} /> Archived</span>
          )}
          {data.isFork && (
            <span className="rd-pill" title="Forked"><FaCodeBranch size={9} /> Fork</span>
          )}
          {data.primaryLanguage && (
            <span className="rd-pill" title={`Primary language: ${data.primaryLanguage.name}`}>
              <span className="rd-lang-dot" style={{ background: data.primaryLanguage.color ?? '#888' }} />
              {data.primaryLanguage.name}
            </span>
          )}
          {ci && (
            <span className={`rd-pill rd-pill-ci ${ciClass(ci)}`} title={`Default branch CI: ${ci}`}>
              {ci === 'SUCCESS' ? <FaCheck size={9} /> : <FaExclamation size={9} />}
              CI {ci.toLowerCase()}
            </span>
          )}
          <span className="rd-stat" title="Stars"><FaStar size={10} /> {data.stargazerCount}</span>
          <span className="rd-stat" title="Forks"><FaCodeBranch size={10} /> {data.forkCount}</span>
          <span className="rd-stat" title="Last push">pushed {shortAgo(data.pushedAt)}</span>
        </div>
      )}

      {data && data.repositoryTopics.nodes.length > 0 && (
        <div className="rd-topics">
          {data.repositoryTopics.nodes.map((t) => (
            <span key={t.topic.name} className="rd-topic">{t.topic.name}</span>
          ))}
        </div>
      )}
    </header>
  )
}
