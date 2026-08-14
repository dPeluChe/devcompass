import { useMemo, type ReactNode } from 'react'
import { FaAlignLeft, FaFileCode, FaComments, FaCheckCircle, FaCodeBranch, FaInfoCircle } from 'react-icons/fa'
import type { PRDetail, ReviewEvent } from '../../api/github'
import { SanitizedMarkdown } from '../SanitizedMarkdown'
import type { AttentionItem } from './types'
import { ChecksList, Skeleton } from './detail/Checks'
import { ConversationList, buildConversation } from './detail/Conversation'
import { SummaryTab } from './detail/Summary'
import { Composer } from './detail/Composer'
import { FilesList, CommitsList } from './DetailModalLists'

export type TabKey = 'summary' | 'description' | 'commits' | 'changes' | 'checks' | 'comments'
export type StatusMsg = { kind: 'ok' | 'err'; text: string } | null

export function ModalBody(props: {
  token: string
  item: AttentionItem
  detail: PRDetail | undefined
  loading: boolean
  error: Error | null
  tab: TabKey
  onTabChange: (t: TabKey) => void
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  body: string
  onBodyChange: (s: string) => void
  status: StatusMsg
  busy: boolean
  busyKind: ReviewEvent | 'COMMENT-ISSUE' | null
  onSubmitComment: () => void
  onSubmitApprove: () => void
  onSubmitRequestChanges: () => void
  isOwnPR: boolean
}) {
  const { token, item, detail, loading, error, tab, onTabChange, composerRef, body, onBodyChange,
          status, busy, busyKind, onSubmitComment, onSubmitApprove, onSubmitRequestChanges, isOwnPR } = props

  const filesCount = detail?.changedFiles ?? 0
  const conv = useMemo(() => buildConversation(detail), [detail])
  const checksCount = detail?.checks.length ?? 0
  const commitsCount = detail?.commits.totalCount ?? 0

  return (
    <div className="hs-modal-body">
      <div className="hs-modal-content">
        <div className="hs-modal-tabs" role="tablist">
          <TabButton active={tab === 'summary'} onClick={() => onTabChange('summary')} icon={<FaInfoCircle />} label="Summary" />
          <TabButton active={tab === 'description'} onClick={() => onTabChange('description')} icon={<FaAlignLeft />} label="Description" />
          <TabButton active={tab === 'commits'} onClick={() => onTabChange('commits')} icon={<FaCodeBranch />} label="Commits" count={commitsCount || undefined} />
          <TabButton active={tab === 'changes'} onClick={() => onTabChange('changes')} icon={<FaFileCode />} label="Changes" count={filesCount || undefined} />
          <TabButton active={tab === 'checks'} onClick={() => onTabChange('checks')} icon={<FaCheckCircle />} label="Checks" count={checksCount || undefined} />
          <TabButton active={tab === 'comments'} onClick={() => onTabChange('comments')} icon={<FaComments />} label="Comments" count={conv.length || undefined} />
        </div>

        {error && (
          <div className="hs-status hs-status-err">
            Failed to load PR: {error.message}
          </div>
        )}

        {tab === 'summary' && (
          loading ? <Skeleton lines={6} /> :
            detail ? (
              <SummaryTab
                detail={detail}
                onReadFull={() => onTabChange('description')}
                onOpenCommits={() => onTabChange('commits')}
                onOpenChecks={() => onTabChange('checks')}
                onOpenComments={() => onTabChange('comments')}
              />
            ) : <span className="hs-muted-text">No data.</span>
        )}

        {tab === 'description' && (
          loading ? <Skeleton lines={4} /> :
            detail?.bodyHTML ? (
              <div className="hs-description-html"><SanitizedMarkdown html={detail.bodyHTML} /></div>
            ) : <span className="hs-muted-text">No description provided.</span>
        )}

        {tab === 'commits' && (
          loading ? <Skeleton lines={5} /> :
            detail?.commits.nodes && detail.commits.nodes.length > 0 ? (
              <CommitsList nodes={detail.commits.nodes} totalCount={detail.commits.totalCount} />
            ) : <span className="hs-muted-text">No commits.</span>
        )}

        {tab === 'changes' && (
          loading ? <Skeleton lines={6} /> :
            detail?.files.nodes && detail.files.nodes.length > 0 ? (
              <FilesList nodes={detail.files.nodes} total={detail.changedFiles} />
            ) : <span className="hs-muted-text">No file changes available.</span>
        )}

        {tab === 'checks' && (
          loading ? <Skeleton lines={5} /> :
            detail?.checks && detail.checks.length > 0 ? (
              <ChecksList token={token} owner={item.org} repo={item.repo} checks={detail.checks} />
            ) : <span className="hs-muted-text">No checks for this PR.</span>
        )}

        {tab === 'comments' && (
          <>
            {loading ? <Skeleton lines={6} /> :
              conv.length > 0 ? (
                <ConversationList items={conv} />
              ) : <span className="hs-muted-text">No comments or reviews yet.</span>}

            <Composer
              composerRef={composerRef}
              body={body}
              onBodyChange={onBodyChange}
              status={status}
              busy={busy}
              busyKind={busyKind}
              onSubmitComment={onSubmitComment}
              onSubmitApprove={onSubmitApprove}
              onSubmitRequestChanges={onSubmitRequestChanges}
              isOwnPR={isOwnPR}
            />
          </>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label, icon, count }: { active: boolean; onClick: () => void; label: string; icon: ReactNode; count?: number }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={`hs-modal-tab ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="hs-modal-tab-icon">{icon}</span>
      <span>{label}</span>
      {count !== undefined && <span className="hs-modal-tab-count">{count}</span>}
    </button>
  )
}
