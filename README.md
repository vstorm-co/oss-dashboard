# Vstorm Open Source Pulse

A simple, responsive dashboard for **vstorm-co** public repository statistics, hosted on GitHub Pages. No backend, database, bundler, or npm/Python dependencies. The browser only fetches static JSON; credentials stay in GitHub Actions.

**[View the dashboard](https://vstorm-co.github.io/oss-dashboard/)**

## Features

- Automatic discovery of the organization's public projects.
- Stars and forks: current totals and daily net changes starting with the first snapshot.
- Pull requests and issues: separate counts of newly created items within the selected period, current open counts, and history by creation date.
- PyPI downloads excluding mirrors, with package names mapped to repositories.
- 7, 30, 90, and 365-day ranges; daily, monthly, and yearly grouping.
- Project filtering, search, sorting, a text view of chart data, and CSV export.
- Persistent history and clear indicators for missing or stale data.

## Local development

Requires Python 3.12+ and Node 22+ for JavaScript tests. No package installation is needed.

```bash
npm start
# http://localhost:4173
```

The repository includes real collected data, so the dashboard works immediately.

```bash
python3 scripts/collect.py  # Refresh metrics
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run build              # Generate publishable files in dist/
```

The collector uses `GH_TOKEN`, then `GITHUB_TOKEN`, or optionally a locally authenticated `gh` session. Without a token, GitHub's public API rate limit may be insufficient. Never store tokens in source code or public site files.

## GitHub Pages

GitHub Pages is configured for this repository. To set up another deployment:

1. In the repository's **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
2. Under **Settings → Actions → General → Workflow permissions**, allow the workflow to write repository contents. The workflow declares `contents: write` to archive measurements. Branch protection rules for `main` must allow these commits; otherwise, provide an authorized bot token through the `METRICS_GITHUB_TOKEN` secret.
3. Push the files to `main` or manually run **Collect metrics and deploy Pages** from the Actions tab.
4. Once deployment succeeds, open the URL shown by the deployment job.

The workflow runs tests, collects metrics, saves history in `data/dashboard.json`, builds a clean `dist/` directory, and deploys through `actions/deploy-pages`. Updates run daily at **07:17 UTC** and on pushes to `main`. GitHub may delay scheduled runs and disables schedules in inactive public repositories; re-enable the workflow if needed. Data commits use `[skip ci]` to avoid an additional run when pushed with a bot token.

Creating files locally does not publish the site or enable its schedule. New deployments require the GitHub Pages setup above.

## Project configuration

Edit `config.json`:

- `organization`: the GitHub organization.
- `exclude`: repository names to omit from the dashboard. Company websites, blog content, and this dashboard are excluded by default. Forks and archived repositories are skipped automatically.
- `packages`: repository name → list of PyPI packages, for example `"memv": ["memvee"]`. Only add packages that belong to the project. Assigning a package to multiple repositories will double-count its downloads.

Excluding a project or removing it from the organization removes it from the current view. Previous data files remain available in Git history.

## Understanding the data

All aggregation dates use UTC. The selected period ends on the date of the latest collector run. The current GitHub day is incomplete; downloads only include completed days supplied by the source. Monthly and yearly groups include only the days within the selected range.

- **Stars/forks:** charts show the difference between two consecutive daily snapshots, including negative changes. History is not reconstructed before collection begins. If a snapshot is missing, the change remains unknown. Multiple runs on the same day replace that day's snapshot.
- **PRs/issues:** `/issues?state=all` includes both types; the collector separates them using the `pull_request` field. History reflects the creation dates of currently available items, not closure or merge dates. Deleted or transferred items may change reconstructed history. Issue content and author information are not stored.
- **PyPI:** [PyPI Stats](https://pypistats.org/api/) provides around 180 days of history. The collector fetches it once daily per package and merges it with saved data, retaining older days. Missing days are not zero, and incomplete totals are labeled as partial. Organization totals may be partial when any package is missing data. Downloads do not represent unique users.
- **Failures:** if an individual repository or package cannot be fetched, available previous data is retained and a warning is recorded. Failure to fetch the organization repository list stops the job without overwriting the file. JSON writes are atomic. Repository and package freshness timestamps remain in the JSON. Data more than 48 hours old triggers a visible warning on the dashboard.
- **CSV:** exports the visible, filtered rows, the UTC range, and a flag for partial download data. Empty values indicate missing data.

A full year of star/fork history requires a year of measurements. Annual download totals become complete as missing days are collected. Earlier history can be imported separately from [public PyPI data in BigQuery](https://packaging.python.org/en/latest/guides/analyzing-pypi-package-downloads/); that import is not included in this version.

## Project structure

- `index.html`, `styles.css`, `app.js`: user interface.
- `metrics.js`: metric aggregation.
- `scripts/collect.py`: data collector.
- `scripts/build.py`: Pages artifact builder.
- `data/dashboard.json`: public measurements.
- `.github/workflows/`: CI and deployment.

Fonts are loaded from Google Fonts, with a system sans-serif fallback when unavailable. All application paths are relative, so the dashboard also works under `/oss-dashboard/`.
