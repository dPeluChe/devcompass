import { isOrgScope, loginFromOrgScope } from './types'
import type { ScopeProps } from './scopes/common'
import { NeedsScope } from './scopes/NeedsScope'
import { SinceScope } from './scopes/SinceScope'
import { IssuesScope } from './scopes/IssuesScope'
import { NotificationsScope } from './scopes/NotificationsScope'
import { ActiveScope, PinnedScope } from './scopes/WorkbenchScopes'
import { OrgScope, ReposScope } from './scopes/ReposScope'
import { DigestScope } from './scopes/DigestScope'

export function ScopeView(props: ScopeProps) {
  const { scope } = props
  if (scope === 'needs') return <NeedsScope {...props} />
  if (scope === 'since') return <SinceScope {...props} />
  if (scope === 'issues') return <IssuesScope {...props} />
  if (scope === 'notifications') return <NotificationsScope {...props} />
  if (scope === 'pinned') return <PinnedScope {...props} />
  if (scope === 'active') return <ActiveScope {...props} />
  if (scope === 'repos') return <ReposScope {...props} />
  if (isOrgScope(scope)) return <OrgScope {...props} login={loginFromOrgScope(scope)} />
  // 'digest' — also the safe fallback for any stale persisted scope key.
  return <DigestScope {...props} />
}
