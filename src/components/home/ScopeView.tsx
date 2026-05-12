import { isOrgScope, loginFromOrgScope } from './types'
import type { ScopeProps } from './scopes/common'
import { NeedsScope } from './scopes/NeedsScope'
import { SinceScope } from './scopes/SinceScope'
import { ActiveScope, PinnedScope } from './scopes/WorkbenchScopes'
import { OrgScope, ReposScope } from './scopes/ReposScope'
import { DigestScope } from './scopes/DigestScope'
import { PlaceholderScope } from './scopes/PlaceholderScope'

export function ScopeView(props: ScopeProps) {
  const { scope } = props
  if (scope === 'needs') return <NeedsScope {...props} />
  if (scope === 'since') return <SinceScope {...props} />
  if (scope === 'pinned') return <PinnedScope {...props} />
  if (scope === 'active') return <ActiveScope {...props} />
  if (scope === 'repos') return <ReposScope {...props} />
  if (scope === 'digest') return <DigestScope {...props} />
  if (isOrgScope(scope)) return <OrgScope {...props} login={loginFromOrgScope(scope)} />
  return <PlaceholderScope scope={scope} />
}
