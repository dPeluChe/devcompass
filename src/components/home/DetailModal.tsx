import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addIssueComment,
  fetchPullRequestDetail,
  mergePullRequest,
  rerunFailedJobs,
  submitReview,
  type MergeMethod,
  type PRDetail,
  type ReviewEvent
} from '../../api/github'
import { queryKeys } from '../../store/queries'
import { getCachedPref, savePref } from '../../store/db'
import type { AttentionItem } from './types'
import { ModalFooter } from './detail/Footer'
import { ModalHead } from './DetailModalHeader'
import { ModalBody, type TabKey, type StatusMsg } from './DetailModalBody'

export type PendingAction = 'approve' | 'request-changes'

type Props = {
  token: string
  /** Used to detect "you authored this" so we can hide review actions GitHub would reject (422). */
  viewerLogin?: string
  item: AttentionItem | null
  /** Review action to fire once the PR detail loads (from an AttentionRow shortcut). */
  pendingAction?: PendingAction | null
  onClose: () => void
  onSnooze: (item: AttentionItem) => void
}

export function DetailModal({ token, viewerLogin, item, pendingAction, onClose, onSnooze }: Props) {
  const open = !!item
  const [tab, setTab] = useState<TabKey>('summary')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<StatusMsg>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()

  // Reset to summary whenever a new item opens.
  useEffect(() => {
    if (item) {
      setTab('summary')
      setBody('')
      setStatus(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  // Lock background scroll while modal is open
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  const detailQuery = useQuery<PRDetail, Error>({
    queryKey: item ? queryKeys.pr(item.org, item.repo, item.number) : ['pr-detail-disabled'],
    queryFn: async () => {
      // 15-min IndexedDB cache for PR detail — opening the same PR twice in a
      // session (or across reloads) skips the GraphQL round-trip.
      const key = `prDetail:${item!.org}/${item!.repo}/${item!.number}`
      const cached = await getCachedPref<PRDetail>(key, 15 * 60 * 1000)
      if (cached) return cached
      const fresh = await fetchPullRequestDetail(token, item!.org, item!.repo, item!.number)
      await savePref(key, fresh)
      return fresh
    },
    enabled: open,
    staleTime: 60 * 1000
  })

  const detail = detailQuery.data

  // GitHub 422s any review you submit on a PR you authored. Detecting this up
  // front lets the UI hide / disable those actions instead of letting the
  // error surface mid-click.
  const isOwnPR = useMemo(() => {
    if (!viewerLogin) return false
    if (item?.reasons.includes('my-pr')) return true
    if (detail?.author?.login === viewerLogin) return true
    return false
  }, [viewerLogin, item, detail])

  function invalidatePr() {
    if (!item) return
    queryClient.invalidateQueries({ queryKey: queryKeys.pr(item.org, item.repo, item.number) })
  }

  // ---- Mutations ----
  const reviewMutation = useMutation({
    mutationFn: (input: { event: ReviewEvent; body?: string }) =>
      submitReview(token, item!.org, item!.repo, item!.number, input.event, input.body),
    onSuccess: (_data, input) => {
      const label = input.event === 'APPROVE' ? 'Approved' :
                    input.event === 'REQUEST_CHANGES' ? 'Changes requested' : 'Comment posted'
      setStatus({ kind: 'ok', text: label })
      setBody('')
      invalidatePr()
    },
    onError: (err: Error) => setStatus({ kind: 'err', text: err.message })
  })
  const commentMutation = useMutation({
    mutationFn: (input: { body: string }) =>
      addIssueComment(token, item!.org, item!.repo, item!.number, input.body),
    onSuccess: () => {
      setStatus({ kind: 'ok', text: 'Comment posted' })
      setBody('')
      invalidatePr()
    },
    onError: (err: Error) => setStatus({ kind: 'err', text: err.message })
  })
  const rerunMutation = useMutation({
    mutationFn: (input: { runIds: number[] }) =>
      Promise.all(input.runIds.map((id) => rerunFailedJobs(token, item!.org, item!.repo, id))).then(() => undefined),
    onSuccess: () => setStatus({ kind: 'ok', text: 'Re-run requested' }),
    onError: (err: Error) => setStatus({ kind: 'err', text: err.message })
  })
  const mergeMutation = useMutation({
    mutationFn: (input: { method: MergeMethod }) =>
      mergePullRequest(token, item!.org, item!.repo, item!.number, input.method),
    onSuccess: (_data, input) => {
      setStatus({ kind: 'ok', text: `Merged via ${input.method}` })
      invalidatePr()
    },
    onError: (err: Error) => setStatus({ kind: 'err', text: err.message })
  })

  const isBusy = reviewMutation.isPending || commentMutation.isPending || rerunMutation.isPending || mergeMutation.isPending

  // Auto-clear status after 4s.
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 4000)
    return () => clearTimeout(t)
  }, [status])

  // ---- Action handlers (kept for both buttons & shortcuts) ----
  const focusComposer = () => {
    setTab('comments')
    queueMicrotask(() => composerRef.current?.focus())
  }
  const submitComment = () => {
    if (!body.trim()) { focusComposer(); setStatus({ kind: 'err', text: 'Comment body required' }); return }
    commentMutation.mutate({ body: body.trim() })
  }
  const submitApprove = () => {
    if (isOwnPR) { setStatus({ kind: 'err', text: "You can't review your own PR" }); return }
    reviewMutation.mutate({ event: 'APPROVE', body: body.trim() || undefined })
  }
  const submitRequestChanges = () => {
    if (isOwnPR) { setStatus({ kind: 'err', text: "You can't review your own PR" }); return }
    if (!body.trim()) { focusComposer(); setStatus({ kind: 'err', text: 'Body required for request changes' }); return }
    reviewMutation.mutate({ event: 'REQUEST_CHANGES', body: body.trim() })
  }

  // Fire a pending review action once the PR detail lands. For approve we can
  // submit immediately (body optional); for request-changes we need a body, so
  // we jump to the composer and let the user finish. Either way we land on the
  // comments tab so the result is visible.
  useEffect(() => {
    if (!pendingAction || !detail || isOwnPR) return
    setTab('comments')
    if (pendingAction === 'approve') {
      reviewMutation.mutate({ event: 'APPROVE', body: body.trim() || undefined })
    } else {
      focusComposer()
      setStatus({ kind: 'err', text: 'Add your change requests below, then submit.' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction, detail, isOwnPR])

  // Find unique workflow run IDs from failing checks for the re-run button.
  const failingRunIds = useMemo(() => {
    if (!detail) return [] as number[]
    const ids = new Set<number>()
    for (const c of detail.checks) {
      if (c.__typename !== 'CheckRun') continue
      if (c.conclusion !== 'FAILURE' && c.conclusion !== 'TIMED_OUT' && c.conclusion !== 'CANCELLED') continue
      const id = c.checkSuite?.workflowRun?.databaseId
      if (id) ids.add(id)
    }
    return [...ids]
  }, [detail])

  const canRerun = failingRunIds.length > 0
  const submitRerun = () => {
    if (!canRerun) return
    rerunMutation.mutate({ runIds: failingRunIds })
  }

  // ---- Keyboard shortcuts (modal-scoped) ----
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // Esc always closes
      if (e.key === 'Escape') { onClose(); return }
      // Skip when typing in composer / inputs / contentEditable
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // 'a' approve
      if (e.key === 'a') { e.preventDefault(); submitApprove(); return }
      // Shift+R request changes
      if (e.key === 'R') { e.preventDefault(); submitRequestChanges(); return }
      // 'c' focus composer
      if (e.key === 'c') { e.preventDefault(); focusComposer(); return }
      // 's' snooze + close
      if (e.key === 's' && item) { e.preventDefault(); onSnooze(item); onClose(); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, body, detail])

  return (
    <div className={`hs-modal-shell ${open ? 'hs-modal-open' : ''}`}>
      <div
        className="hs-modal-backdrop"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
        role="button"
        tabIndex={-1}
        aria-label="Close detail"
      />
      <div
        className="hs-modal"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {item && (
          <>
            <ModalHead item={item} detail={detail} onClose={onClose} />
            <ModalBody
              token={token}
              item={item}
              detail={detail}
              loading={detailQuery.isLoading}
              error={detailQuery.error}
              tab={tab}
              onTabChange={setTab}
              composerRef={composerRef}
              body={body}
              onBodyChange={setBody}
              status={status}
              busy={isBusy}
              busyKind={
                reviewMutation.isPending ? (reviewMutation.variables?.event ?? null) :
                commentMutation.isPending ? 'COMMENT-ISSUE' :
                null
              }
              onSubmitComment={submitComment}
              onSubmitApprove={submitApprove}
              onSubmitRequestChanges={submitRequestChanges}
              isOwnPR={isOwnPR}
            />
            <ModalFooter
              detail={detail}
              isOwnPR={isOwnPR}
              canRerun={canRerun}
              rerunBusy={rerunMutation.isPending}
              onRerun={submitRerun}
              onApprove={submitApprove}
              approveBusy={reviewMutation.isPending && reviewMutation.variables?.event === 'APPROVE'}
              onMerge={(method) => mergeMutation.mutate({ method })}
              mergeBusy={mergeMutation.isPending}
              onSnooze={() => { onSnooze(item); onClose() }}
            />
          </>
        )}
      </div>
    </div>
  )
}
