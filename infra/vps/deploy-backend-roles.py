"""Backend role rollout. Default rehearsal renders configuration without changes.

Run under the workflow's existing deployment flock. Credentials stay in process
environments/stdin; checkpoints contain only queue pause state and image names.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def command(args, payload=None, timeout=180):
    result = subprocess.run(args, input=payload, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError('Operation failed: ' + args[0])
    return result.stdout


def inspect(name, optional=False):
    result = subprocess.run(['docker', 'inspect', name], capture_output=True, text=True, timeout=20)
    if result.returncode and optional and any(message in result.stderr for message in ['No such object: ' + name, 'No such container: ' + name]):
        return None
    if result.returncode:
        raise RuntimeError('Container unavailable')
    return json.loads(result.stdout)[0]


def environment(item):
    return dict(value.split('=', 1) for value in item['Config']['Env'] if '=' in value)


def runtime_user():
    # Bind-mounted checkpoint files must stay readable by the VPS operator.
    return str(os.getuid()) + ':' + str(os.getgid())


def checkpoint_directory(run_id):
    assert re.fullmatch(r'[0-9]+', run_id), 'Numeric deployment ID required'
    parent = (Path.home() / '.hub-backend-runtime').resolve()
    directory = parent / run_id
    assert directory.resolve().parent == parent, 'Checkpoint path escaped runtime directory'
    return directory


def recover(run_id):
    directory = checkpoint_directory(run_id)
    metadata = json.loads((directory / 'operation.json').read_text())
    for key in ['previousImage', 'helperImage']:
        assert re.fullmatch(r'ghcr.io/gen7fuel/thehub-backend:[a-f0-9]{40}', metadata[key])
    current = inspect('backend')
    labels = current['Config']['Labels']
    assert labels['com.docker.compose.project'] == metadata['project']
    assert labels['com.docker.compose.service'] == 'backend'
    for name, service in [('backend-worker', 'worker'), ('backend-scheduler', 'scheduler')]:
        item = inspect(name, optional=True)
        if item:
            assert item['Config']['Labels']['com.docker.compose.project'] == metadata['project']
            assert item['Config']['Labels']['com.docker.compose.service'] == service
    values = environment(current)
    # Rehydrate only this process; never print or persist the credentials.
    os.environ.update(values)
    os.environ.update(BACKEND_IMAGE=metadata['helperImage'], AUTH_BACKEND_IMAGE='fixture:unused', CDN_IMAGE='fixture:unused')
    for action in ['prepare', 'resume', 'recovery-resume']:
        helper_name = 'hub-runtime-cutover-' + run_id + '-' + action
        helper = inspect(helper_name, optional=True)
        if helper:
            assert helper['Config']['Labels'].get('com.gen7.runtime') == 'cutover'
            if helper['State']['Running']:
                command(['docker', 'stop', '--time', '10', helper_name], timeout=30)
            helper = inspect(helper_name, optional=True)
            assert not helper or not helper['State']['Running'], 'Cutover helper still running; recovery stopped'
    command(['docker', 'compose', 'stop', '--timeout', '600', 'backend', 'worker', 'scheduler'], timeout=660)
    for name in ['backend', 'backend-worker', 'backend-scheduler']:
        item = inspect(name, optional=True)
        assert not item or not item['State']['Running'], 'Runtime still running; recovery stopped'
    command(['docker', 'compose', 'rm', '-f', 'worker', 'scheduler'])
    override = {'services': {'backend': {'image': metadata['previousImage'], 'command': ['node', 'app.js'],
                                       'environment': {**values, 'HUB_PROCESS_ROLE': 'all'}}}}
    command(['docker', 'compose', '-f', 'compose.yaml', '-f', '-', 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '180', 'backend'],
            json.dumps(override), timeout=240)
    assert metadata['network'] in inspect('redis')['NetworkSettings']['Networks']
    helper_name = 'hub-runtime-cutover-' + run_id + '-recovery-resume'
    try:
        command(['docker', 'run', '--rm', '--user', runtime_user(), '--name', helper_name, '--label', 'com.gen7.runtime=cutover',
                 '--network', metadata['network'], '-e', 'REDIS_URL', '-v', str(directory) + ':/checkpoint',
                 metadata['helperImage'], 'node', 'scripts/runtime-cutover.cjs', 'resume'], timeout=660)
    finally:
        helper = inspect(helper_name, optional=True)
        if helper and helper['State']['Running']:
            command(['docker', 'stop', '--time', '10', helper_name], timeout=30)
            helper = inspect(helper_name, optional=True)
            assert not helper or not helper['State']['Running'], 'Recovery helper still running'
    print(json.dumps({'recoveredPreviousCombinedBackend': True, 'previousQueuePauseStatesRestored': True}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--recover', metavar='RUN_ID', help='Restore previous combined backend and original queue pause states')
    args = parser.parse_args()
    root = Path.cwd()
    assert (root / 'compose.yaml').is_file()
    assert not Path('/home/gen7fuel/.hub-cdn-deploy-freeze').exists()
    assert not (args.execute and args.recover), 'Choose execute or recovery'
    if args.recover:
        recover(args.recover)
        return
    original = inspect('backend')
    old_env = environment(original)
    rendered = json.loads(command(['docker', 'compose', 'config', '--format', 'json']))['services']
    project = original['Config']['Labels']['com.docker.compose.project']
    assert original['Config']['Labels']['com.docker.compose.service'] == 'backend'
    for name, service in [('backend-worker', 'worker'), ('backend-scheduler', 'scheduler')]:
        current = inspect(name, optional=True)
        if current:
            assert current['Config']['Labels']['com.docker.compose.project'] == project
            assert current['Config']['Labels']['com.docker.compose.service'] == service
    for service, entry in [('backend', 'api.js'), ('worker', 'worker.js'), ('scheduler', 'scheduler.js')]:
        value = rendered[service]
        assert value['image'] == os.environ['BACKEND_IMAGE']
        assert value['command'] == ['node', entry]
        for key, value in value['environment'].items():
            assert old_env.get(key, '') == str(value or ''), 'Existing runtime settings changed unexpectedly'
    if not args.execute:
        print(json.dumps({'rehearsal': True, 'roles': ['api', 'worker', 'scheduler'], 'existingSettingsPreserved': True}))
        return
    run_id = os.environ.get('HUB_RUNTIME_DEPLOYMENT_ID', '')
    directory = checkpoint_directory(run_id)
    for checkpoint in directory.parent.glob('*/state.json'):
        assert json.loads(checkpoint.read_text())['phase'] == 'resumed', 'Unfinished cutover requires recovery before retry'
    directory.mkdir(parents=True, mode=0o700, exist_ok=False)
    os.chmod(directory, 0o700)
    network = sorted(set(original['NetworkSettings']['Networks']) & set(inspect('redis')['NetworkSettings']['Networks']))[0]
    image = os.environ['BACKEND_IMAGE']
    metadata = {'previousImage': original['Config']['Image'], 'helperImage': image, 'project': project, 'network': network}
    (directory / 'operation.json').write_text(json.dumps(metadata))
    os.chmod(directory / 'operation.json', 0o600)
    helper_safe = True

    def queues(action):
        nonlocal helper_safe
        name = 'hub-runtime-cutover-' + run_id + '-' + action
        assert inspect(name, optional=True) is None, 'Previous cutover helper still exists'
        try:
            command(['docker', 'run', '--rm', '--user', runtime_user(), '--name', name, '--network', network, '--label', 'com.gen7.runtime=cutover',
                     '-e', 'REDIS_URL', '-v', str(directory) + ':/checkpoint', image,
                     'node', 'scripts/runtime-cutover.cjs', action], timeout=660)
        finally:
            # A timed-out Docker CLI can leave its container running. Never let
            # an old prepare process pause queues after recovery has resumed them.
            helper_safe = False
            item = inspect(name, optional=True)
            if item and item['State']['Running']:
                helper_safe = False
                command(['docker', 'stop', '--time', '10', name], timeout=30)
                item = inspect(name, optional=True)
                assert not item or not item['State']['Running'], 'Cutover helper still running'
            helper_safe = True

    def up(services, override=None):
        cli = ['docker', 'compose', '-f', 'compose.yaml']
        if override:
            cli += ['-f', '-']
        command(cli + ['up', '-d', '--no-deps', '--wait', '--wait-timeout', '180'] + services,
                json.dumps(override) if override else None, timeout=240)

    def stop():
        command(['docker', 'compose', 'stop', '--timeout', '600', 'backend', 'worker', 'scheduler'], timeout=660)
        for name in ['backend', 'backend-worker', 'backend-scheduler']:
            current = inspect(name, optional=True)
            assert not current or not current['State']['Running'], 'Runtime still running; queues must remain paused'

    stopped = False
    safe_to_resume = True
    try:
        queues('prepare')
        stopped = True
        safe_to_resume = False
        stop()
        up(['backend'])
        command(['docker', 'compose', 'exec', '-T', 'backend', 'node', 'scripts/pg-migrate.js'], timeout=300)
        up(['worker'])
        up(['scheduler'])
        for name, role in [('backend-worker', 'worker'), ('backend-scheduler', 'scheduler')]:
            state = json.loads(command(['docker', 'exec', name, 'curl', '-fsS', 'http://localhost:5000/health']))
            assert state['role'] == role and state['ready']
            if role == 'worker':
                assert len(state['workers']) == 16 and not state['schedules']
            else:
                assert not state['workers'] and state['leader'] and len(state['schedules']) == 19
        print(json.dumps({'rolesHealthy': True, 'workerCount': 16, 'scheduleCount': 19}))
        safe_to_resume = True
    except Exception:
        if stopped:
            safe_to_resume = False
            stop()
            command(['docker', 'compose', 'rm', '-f', 'worker', 'scheduler'])
            rollback_env = {**old_env, 'HUB_PROCESS_ROLE': 'all'}
            up(['backend'], {'services': {'backend': {'image': original['Config']['Image'],
               'command': ['node', 'app.js'], 'environment': rollback_env}}})
            safe_to_resume = True
            print(json.dumps({'rolledBackToPreviousCombinedBackend': True}))
        raise
    finally:
        if safe_to_resume and helper_safe and (directory / 'state.json').exists():
            queues('resume')
        elif (directory / 'state.json').exists():
            print(json.dumps({'queuesRemainPaused': True, 'operatorRecoveryRequired': True}))
    print(json.dumps({'deployedRoles': ['api', 'worker', 'scheduler'], 'previousQueuePauseStatesRestored': True}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'success': False, 'errorType': type(error).__name__}), file=sys.stderr)
        sys.exit(1)
