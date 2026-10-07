"""Detect changes without interpolating PR-controlled text into shell commands."""
import json
import os
import subprocess
from pathlib import Path


def classify(paths):
    backend = frontend = False
    for path in paths:
        if path.endswith(('.md', '/.gitkeep')) or path.startswith('docs/'):
            continue
        if path.startswith('backend/'):
            backend = True
        elif path.startswith('frontend/'):
            frontend = True
        else:
            # Workflow, runtime, shared code, and unknown root changes affect both.
            backend = frontend = True
    return {'backend': backend, 'frontend': frontend, 'environment': backend or frontend}


def changed_paths(event_name, event):
    if event_name == 'workflow_dispatch':
        return None
    if event_name == 'pull_request':
        base = event['pull_request']['base']['sha']
        head = event['pull_request']['head']['sha']
        comparison = f'{base}...{head}'
    elif event_name == 'push':
        base, head = event.get('before'), event['after']
        if not base or set(base) == {'0'}:
            return None
        comparison = f'{base}..{head}'
    else:
        return None
    # Verify refs and fail closed if history is incomplete.
    try:
        result = subprocess.run(
            ['git', 'diff', '--name-only', '--no-renames', '-z', comparison, '--'],
            check=True, capture_output=True,
        )
    except subprocess.CalledProcessError:
        return None
    return result.stdout.decode().rstrip('\0').split('\0') if result.stdout else []


def main():
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    paths = changed_paths(os.environ['GITHUB_EVENT_NAME'], event)
    flags = dict.fromkeys(['backend', 'frontend', 'environment'], True) if paths is None else classify(paths)
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        for key, value in flags.items():
            output.write(f'{key}={str(value).lower()}\n')
    print(json.dumps(flags))


if __name__ == '__main__':
    main()
