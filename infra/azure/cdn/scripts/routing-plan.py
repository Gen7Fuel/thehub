"""Read-only deployment preflight. Emits only fixed, allowlisted shell values.

Does not change routing, state, writer controls or deployment settings.
"""
import argparse
import json
import os
import subprocess
from pathlib import Path
import sys

AZURE = 'https://gen7erp-cdn-prod-29b24248.azurewebsites.net'
TARGETS = {
    'legacy': ('vps', 'http://cdn:5001', 'cdn:5001'),
    'azure': ('azure', AZURE, AZURE),
    'standby': ('azure', 'http://cdn-rollback-vps:5001', 'cdn-rollback-vps:5001'),
}


def validate_backend(current_url, desired_url, changing):
    current = current_url.rstrip('/') or 'http://cdn:5001'
    desired = desired_url.rstrip('/') or 'http://cdn:5001'
    if current != desired and not changing:
        raise ValueError('Backend endpoint change requires a backend deployment')


def plan(state_path, deploy_target, service_url, frozen=False):
    if frozen:
        raise ValueError('Deployment frozen for CDN migration')
    state_path = Path(state_path)
    if state_path.exists():
        state = json.loads(state_path.read_text())
        if state.get('version') != 1 or state.get('target') not in TARGETS:
            raise ValueError('Invalid persistent CDN routing state')
        target = state['target']
    else:
        if deploy_target not in ('', 'vps'):
            raise ValueError('Managed CDN deployment requires persistent routing state')
        target = 'legacy'
    expected_deploy, expected_service, upstream = TARGETS[target]
    if (deploy_target or 'vps') != expected_deploy:
        raise ValueError('Deployment target conflicts with persistent CDN routing state')
    actual = service_url.rstrip('/')
    if target == 'legacy' and not actual:
        actual = expected_service
    if actual != expected_service:
        raise ValueError('CDN_SERVICE_URL conflicts with persistent CDN routing state')
    return {'CDN_PUBLIC_UPSTREAM': upstream}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state', default='/home/gen7fuel/.hub-cdn-routing.json')
    parser.add_argument('--freeze-file', default='/home/gen7fuel/.hub-cdn-deploy-freeze')
    parser.add_argument('--check-backend', action='store_true')
    parser.add_argument('--backend-changing', choices=['true', 'false'], default='false')
    args = parser.parse_args()
    try:
        result = plan(args.state, os.getenv('CDN_DEPLOY_TARGET', ''),
                      os.getenv('CDN_SERVICE_URL', ''),
                      os.getenv('CDN_MIGRATION_FREEZE') == 'true' or Path(args.freeze_file).exists())
        if args.check_backend:
            inspected = subprocess.run(['docker', 'inspect', 'backend'], capture_output=True, text=True, timeout=15, check=True)
            # Docker configuration can contain credentials. Keep all values in
            # memory and never log command output or provider exceptions.
            env = dict(item.split('=', 1) for item in json.loads(inspected.stdout)[0]['Config']['Env'] if '=' in item)
            validate_backend(env.get('CDN_SERVICE_URL', ''), os.getenv('CDN_SERVICE_URL', ''), args.backend_changing == 'true')
        for key, value in result.items():
            print(f'export {key}={value}')
    except (ValueError, OSError, TypeError, AttributeError, KeyError, IndexError, subprocess.SubprocessError):
        # Never echo configuration values or arbitrary state contents.
        print('CDN deployment preflight failed; check freeze, routing state and target settings.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
