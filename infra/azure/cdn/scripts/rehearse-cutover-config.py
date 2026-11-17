"""Default: read-only rehearsal of exact Compose config/override inputs on VPS.

Reconstructs variables from running containers; credentials never leave memory.
Production path requires explicit flags, reviewed backup proof and writer fences.
Neither mode writes credential env files or modifies GitHub settings.
"""
import json
import argparse
import fcntl
from datetime import datetime, timezone
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.request

AZURE = 'https://gen7erp-cdn-prod-29b24248.azurewebsites.net'


def validate_stopped_azure(proof, target, now):
    expected = '/subscriptions/29b24248-1990-4592-b25d-e6ee8e9db784/resourceGroups/Gen7ERP/providers/Microsoft.Web/sites/gen7erp-cdn-prod-29b24248'
    assert target == 'standby', 'Stopped Azure proof is only valid for standby recovery'
    assert proof.get('id', '').lower() == expected.lower(), 'Wrong App Service in stopped-state proof'
    assert proof.get('state', '').lower() == 'stopped', 'App Service must be confirmed stopped'
    observed = datetime.fromisoformat(proof['observedAt'].replace('Z', '+00:00')).timestamp()
    assert 0 <= now - observed <= 180, 'Fresh control-plane stopped-state proof required'


def inspect(name):
    return json.loads(subprocess.run(['docker', 'inspect', name], capture_output=True,
                                    text=True, timeout=20, check=True).stdout)[0]


def env(item):
    return dict(v.split('=', 1) for v in item['Config']['Env'] if '=' in v)


def compose(root, values, override):
    # stdin is an ephemeral Compose override. Full rendered config contains
    # credentials, so capture it in memory; never print raw stdout/stderr.
    result = subprocess.run(['docker', 'compose', '-f', 'compose.yaml', '-f', '-',
                             'config', '--format', 'json'], cwd=root, input=json.dumps(override),
                            env={**os.environ, **values}, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuntimeError('Compose configuration rehearsal failed')
    return json.loads(result.stdout)['services']


def equivalent(actual, candidate, changes):
    # Check every explicitly configured environment key; baked-in image keys
    # such as PATH need not appear in the Compose environment map.
    for key, value in candidate.get('environment', {}).items():
        assert str(value if value is not None else '') == changes.get(key, actual.get(key, '')), 'Unexpected environment difference'
    for key, value in changes.items():
        assert candidate['environment'].get(key) == value, 'Planned environment override missing'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply-target', choices=['azure', 'standby'])
    parser.add_argument('--execute-production', action='store_true')
    parser.add_argument('--activate-selected-writer', action='store_true')
    parser.add_argument('--verified-backup-proof')
    parser.add_argument('--azure-stopped-proof')
    args = parser.parse_args()
    assert bool(args.apply_target) == args.execute_production, 'Production execution requires an explicit target and flag'
    names = ['backend', 'auth-backend', 'cdn', 'webserver', 'postgres', 'desk-api', 'desk-cdn-backup', 'desk-caddy']
    before = {name: inspect(name) for name in names}
    lock = None
    if args.apply_target:
        assert args.activate_selected_writer, 'Explicit selected-writer activation flag required'
        assert Path('/home/gen7fuel/.hub-cdn-deploy-freeze').exists(), 'Deployment freeze marker required'
        assert not before['backend']['State']['Running'], 'Hub producers must be stopped'
        assert not before['desk-cdn-backup']['State']['Running'], 'Backup worker must be idle and stopped'
        assert args.verified_backup_proof
        proof = json.loads(Path(args.verified_backup_proof).read_text())
        assert proof.get('fullBackupVerified') is True and re.fullmatch('[a-f0-9]{64}', proof.get('manifestSha256', ''))
        assert proof.get('files', 0) > 0 and proof.get('months')
        activation_path = Path('/home/gen7fuel/.hub-cdn-new-account-activated')
        if not activation_path.exists():
            verified_at = datetime.fromisoformat(proof['verifiedAt'].replace('Z', '+00:00')).timestamp()
            assert verified_at >= Path('/home/gen7fuel/.hub-cdn-deploy-freeze').stat().st_mtime, 'Fresh frozen backup proof required for initial cutover'
        lock = open('/home/gen7fuel/.hub-deploy.lock', 'a')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    stopped_proof = None
    if args.azure_stopped_proof:
        assert args.apply_target and args.execute_production
        stopped_proof = json.loads(Path(args.azure_stopped_proof).read_text())
        validate_stopped_azure(stopped_proof, args.apply_target, datetime.now(timezone.utc).timestamp())
    hub = Path('/home/gen7fuel/thehub')
    desk = Path('/home/gen7fuel/desk')
    environments = {name: env(item) for name, item in before.items()}
    placeholders = set(re.findall(r'\$\{([A-Za-z_][A-Za-z0-9_]*)', (hub / 'compose.yaml').read_text()))
    values = {}
    for key in placeholders:
        found = {environments[name][key] for name in ['backend', 'auth-backend', 'cdn', 'postgres'] if key in environments[name]}
        assert len(found) <= 1, 'Conflicting shared Compose variable'
        if found:
            values[key] = found.pop()
    values.update({'BACKEND_IMAGE': before['backend']['Config']['Image'],
                   'AUTH_BACKEND_IMAGE': before['auth-backend']['Config']['Image'],
                   'CDN_IMAGE': before['cdn']['Config']['Image']})
    current = compose(hub, values, {'services': {}})
    equivalent(environments['backend'], current['backend'], {})
    equivalent(environments['cdn'], current['cdn'], {})
    rows = []
    candidates = {}
    for target, service, upstream in [('azure', AZURE, AZURE),
                                       ('standby', 'http://cdn-rollback-vps:5001', 'cdn-rollback-vps:5001')]:
        override = {'services': {'backend': {'environment': {'CDN_SERVICE_URL': service}},
                                 'caddy': {'environment': {'CDN_PUBLIC_UPSTREAM': upstream}}}}
        rendered = compose(hub, values, override)
        candidates[target] = override
        equivalent(environments['backend'], rendered['backend'], {'CDN_SERVICE_URL': service})
        equivalent(environments['cdn'], rendered['cdn'], {})
        assert rendered['caddy']['environment']['CDN_PUBLIC_UPSTREAM'] == upstream
        assert rendered['backend']['image'] == values['BACKEND_IMAGE']
        rows.append({'target': target, 'allExistingBackendSettingsPreserved': True,
                     'originalCdnSettingsPreserved': True, 'publicAndBackendEndpointOverridesMatch': True})
    identity = environments['backend']
    changes = {'CDN_BACKUP_SOURCE_ACCOUNT': 'gen7erpmedia29b24248', 'CDN_BACKUP_SOURCE_CONTAINER': 'hub',
               'CDN_BACKUP_SOURCE_TENANT_ID': identity['AZURE_TENANT_ID'],
               'CDN_BACKUP_SOURCE_CLIENT_ID': identity['AZURE_CLIENT_ID'],
               'CDN_BACKUP_SOURCE_CLIENT_SECRET': identity['AZURE_CLIENT_SECRET']}
    desk_values = {'BACKEND_IMAGE': before['desk-api']['Config']['Image'],
                   'FRONTEND_IMAGE': before['desk-caddy']['Config']['Image']}
    rendered = compose(desk, desk_values, {'services': {name: {'environment': changes} for name in ['api', 'cdn-backup']}})
    equivalent(environments['desk-api'], rendered['api'], changes)
    equivalent(environments['desk-cdn-backup'], rendered['cdn-backup'], changes)
    assert rendered['api']['environment']['AZURE_STORAGE_CONNECTION_STRING'] == environments['desk-api']['AZURE_STORAGE_CONNECTION_STRING']
    assert rendered['cdn-backup']['environment']['AZURE_CONTAINER'] == environments['desk-cdn-backup']['AZURE_CONTAINER']
    for name, original in before.items():
        after = inspect(name)
        assert after['Id'] == original['Id'] and after['State']['StartedAt'] == original['State']['StartedAt']
        assert after['Config']['Env'] == original['Config']['Env']
    if args.apply_target:
        token = environments['cdn']['CDN_ADMIN_TOKEN']
        for base in ['http://127.0.0.1:5001', AZURE, 'http://127.0.0.1:15001']:
            if base == 'http://127.0.0.1:5001' and not before['cdn']['State']['Running']:
                continue
            if base == AZURE and stopped_proof:
                validate_stopped_azure(stopped_proof, args.apply_target, datetime.now(timezone.utc).timestamp())
                continue
            request = urllib.request.Request(base + '/cdn/maintenance', headers={'Authorization': 'Bearer ' + token})
            with urllib.request.urlopen(request, timeout=30) as response:
                state = json.load(response)
                assert state['paused'] and state['drained'] and state['activeWrites'] == 0, 'All writers must remain fenced'
        def up(root, inputs, override, services):
            result = subprocess.run(['docker', 'compose', '-f', 'compose.yaml', '-f', '-', 'up', '-d',
                                     '--no-deps', '--wait', '--wait-timeout', '120', *services],
                                    cwd=root, env={**os.environ, **inputs}, input=json.dumps(override),
                                    capture_output=True, text=True, timeout=180)
            if result.returncode:
                raise RuntimeError('Reader update failed; keep freeze and writers paused')
        # This file contains no credentials. State and future workflow settings
        # must agree before the deployment freeze can be removed.
        state_path = Path('/home/gen7fuel/.hub-cdn-routing.json')
        temp = state_path.with_suffix('.tmp')
        temp.write_text(json.dumps({'version': 1, 'target': args.apply_target}))
        os.replace(temp, state_path)
        # Route reads first while producers remain stopped. Start producers only
        # after their selected destination accepts writes, avoiding failed jobs
        # caused by starting workers against a paused CDN.
        up(hub, values, candidates[args.apply_target], ['caddy'])
        selected = AZURE if args.apply_target == 'azure' else 'http://127.0.0.1:15001'
        def health(base):
            with urllib.request.urlopen(base + '/cdn/health', timeout=30) as response:
                return json.load(response)
        direct, public = health(selected), health('https://app.gen7fuel.com')
        assert direct['release'] and public['release'] == direct['release']
        assert public['paused'] and public['drained']
        def maintenance(paused):
            request = urllib.request.Request(selected + '/cdn/maintenance',
                data=json.dumps({'paused': paused}).encode(),
                headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=45) as response:
                state = json.load(response)
                assert state['paused'] == paused
                if paused:
                    assert state['drained'] and state['activeWrites'] == 0
        # Record the irreversible boundary BEFORE activation: a failed network
        # response may still follow a committed unpause. Never infer otherwise.
        if not activation_path.exists():
            with activation_path.open('x') as file:
                json.dump({'target': args.apply_target, 'manifestSha256': proof['manifestSha256'],
                           'activationAttemptAt': datetime.now(timezone.utc).isoformat()}, file)
                file.flush(); os.fsync(file.fileno())
        if stopped_proof:
            validate_stopped_azure(stopped_proof, args.apply_target, datetime.now(timezone.utc).timestamp())
        maintenance(False)
        try:
            up(hub, values, candidates[args.apply_target], ['backend'])
            up(desk, desk_values, {'services': {name: {'environment': changes} for name in ['api', 'cdn-backup']}}, ['api', 'cdn-backup'])
        except Exception:
            maintenance(True)
            raise
        print(json.dumps({'readersSwitched': True, 'target': args.apply_target, 'selectedWriterEnabled': True,
                          'otherWritersRemainFenced': True, 'deploymentFreezeRetained': True, 'githubSettingsChanged': False}))
        lock.close()
        return
    print(json.dumps({'success': True, 'hubCandidates': rows, 'deskExistingSettingsAndArchiveDestinationPreserved': True,
                      'productionContainersUnchanged': True, 'composeUpCalls': 0, 'secretFilesWritten': 0,
                      'productionCutover': False}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'success': False, 'errorType': type(error).__name__}), file=sys.stderr)
        sys.exit(1)
