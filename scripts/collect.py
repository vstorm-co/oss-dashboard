"""Collect public metrics. Standard library only; never put credentials in output."""
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def request(url):
    headers = {'User-Agent': 'vstorm-oss-dashboard', 'Accept': 'application/vnd.github+json' if 'api.github.com/' in url else 'application/json'}
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if 'api.github.com/' in url and not token:
        try:
            result = subprocess.run(['gh', 'auth', 'token'], capture_output=True, text=True)
            token = result.stdout.strip() if result.returncode == 0 else None
        except FileNotFoundError:
            token = None
    if token and 'api.github.com/' in url:
        headers['Authorization'] = f'Bearer {token}'
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=40) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
            time.sleep(min(30, int(exc.headers.get('Retry-After', '5'))))


def pages(path):
    result = []
    for page in range(1, 1001):
        chunk = request(f'https://api.github.com/{path}{"&" if "?" in path else "?"}per_page=100&page={page}')
        result.extend(chunk)
        if len(chunk) < 100:
            return result
    raise RuntimeError('Pagination limit reached; refusing incomplete counts')


def merge_days(old, new):
    return dict(sorted({**old, **new}.items()))


def main():
    config = json.loads((ROOT / 'config.json').read_text())
    path = ROOT / 'data/dashboard.json'
    previous = json.loads(path.read_text()) if path.exists() else {'projects': []}
    old_projects = {p['name']: p for p in previous['projects']}
    now = dt.datetime.now(dt.timezone.utc)
    today = now.date().isoformat()
    output = {'organization': config['organization'], 'updatedAt': now.isoformat(), 'projects': [], 'warnings': []}
    repos = pages(f'orgs/{config["organization"]}/repos?type=public')
    for repo in sorted(repos, key=lambda r: r['stargazers_count'], reverse=True):
        if repo['fork'] or repo['archived'] or repo['name'] in config['exclude']:
            continue
        name = repo['name']
        old = old_projects.get(name, {})
        print(f'Collecting {name}', flush=True)
        # The issues endpoint includes PRs. Explicitly split them to avoid double counting.
        try:
            issues = pages(f'repos/{repo["full_name"]}/issues?state=all')
            events = {}
            for issue in issues:
                day = issue['created_at'][:10]
                key = 'prs' if 'pull_request' in issue else 'issues'
                events.setdefault(day, {'prs': 0, 'issues': 0})[key] += 1
            snapshot = {'stars': repo['stargazers_count'], 'forks': repo['forks_count'],
                        'prs': sum('pull_request' in i for i in issues),
                        'issues': sum('pull_request' not in i for i in issues),
                        'openPrs': sum('pull_request' in i and i['state'] == 'open' for i in issues),
                        'openIssues': sum('pull_request' not in i and i['state'] == 'open' for i in issues)}
        except Exception as exc:
            output['warnings'].append(f'{name}: GitHub — collection failed ({type(exc).__name__}); previous data retained where available.')
            if old:
                output['projects'].append(old)
            continue
        packages = {}
        for package in config['packages'].get(name, []):
            saved = old.get('packages', {}).get(package, {'days': {}, 'updatedAt': None})
            # PyPI Stats updates once daily: reuse today's cached response.
            if (saved.get('updatedAt') or '').startswith(today):
                packages[package] = saved
                continue
            try:
                response = request(f'https://pypistats.org/api/packages/{package}/overall?mirrors=false')
                days = {r['date']: r['downloads'] for r in response['data'] if r['category'] == 'without_mirrors' and r['date'] < today}
                if not days:
                    raise ValueError('No completed daily data')
                packages[package] = {'days': merge_days(saved['days'], days), 'updatedAt': now.isoformat()}
            except Exception as exc:
                packages[package] = saved
                output['warnings'].append(f'{package}: PyPI Stats — source unavailable ({type(exc).__name__}); previous data retained where available.')
        output['projects'].append({'name': name, 'url': repo['html_url'], 'description': repo['description'] or '',
            'language': repo['language'], 'createdAt': repo['created_at'][:10], 'updatedAt': now.isoformat(),
            'snapshots': merge_days(old.get('snapshots', {}), {today: snapshot}), 'events': events, 'packages': packages})
    if not output['projects']:
        raise RuntimeError('No projects collected; retaining previous file')
    path.parent.mkdir(exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)
    print(f'Saved {len(output["projects"])} projects; {len(output["warnings"])} warnings')


if __name__ == '__main__':
    main()
