# Security

## Reporting an issue

If you find a problem that affects token safety or the privacy guarantees described in the README, please **email antonio@feedby.ai** instead of opening a public issue. I will respond within a week.

For non-sensitive bugs, the regular [issue tracker](https://github.com/dPeluChe/devcompass/issues) is fine.

## Supported versions

devcompass is pre-1.0. Only the latest commit on `main` is supported. Fixes will not be backported to older builds.

## Threat model

devcompass is a browser-only single-page app. There is no backend that we operate.

| What we promise | What we do not promise |
| --- | --- |
| Your Personal Access Token is stored in `localStorage` and only sent to `api.github.com`. | The browser environment itself is safe. A malicious extension can read `localStorage`. |
| No analytics, no telemetry, no third-party network calls outside the GitHub API. | The token will never appear in screenshots / logs you take of your own DevTools. Mask it yourself before sharing. |
| GitHub-supplied HTML (PR / issue bodies) is rendered through DOMPurify before insertion. | A new GitHub markdown feature could expose a sanitizer gap before we update. Please report it. |
| The PAT is masked (`***`) in every UI surface, including the Cache and Storage panels. | We cannot stop you from pasting your raw PAT into a screenshot. |

## Where the token lives

| Surface | What is stored | Where |
| --- | --- | --- |
| Login | Raw PAT, ASCII-sanitized | `localStorage["ghviewer.pat"]` |
| Cache panel | Token reference key only | IndexedDB `ghviewer.tokens` (id `current`) |
| Network | `Authorization: bearer <token>` | Request header to `api.github.com`, never to a server we operate |

You can wipe everything from **Settings → Storage → Clear all cache**, or by deleting the `ghviewer.pat` key and `ghviewer` IndexedDB database from your browser.

## Dependencies

`npm audit` is part of the recommended pre-merge checks (see the README). The build will not fail on advisories — that is a manual review. If you find a transitive dependency that worries you, open an issue and we will look at upgrading or pinning.
