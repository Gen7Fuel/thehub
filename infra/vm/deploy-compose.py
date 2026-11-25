#!/usr/bin/env python3
"""Promote approved image digests on an already active Gen7 VM Compose project."""
import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


APPS = {
    'hub': {
        'files': ('compose.yaml', 'compose.vm.yaml', 'infra/vm/Caddyfile'),
        'compose': ('compose.vm.yaml',),
        'roles': {
            'backend': ('thehub-backend', 'BACKEND_IMAGE', ('backend', 'worker', 'scheduler')),
            'auth': ('thehub-auth-backend-vm', 'AUTH_BACKEND_IMAGE', ('auth-backend',)),
            'frontend': ('thehub-frontend-vm', 'HUB_FRONTEND_IMAGE', ('frontend',)),
        },
    },
    'desk': {
        'files': ('compose.yaml', 'compose.vm.yaml', 'Caddyfile'),
        'compose': ('compose.yaml', 'compose.vm.yaml'),
        'roles': {
            'backend': ('desk-api', 'BACKEND_IMAGE', ('api',)),
            'frontend': ('desk-frontend', 'FRONTEND_IMAGE', ('caddy',)),
        },
    },
}
HEX64 = re.compile(r'[a-f0-9]{64}')
HUB_CONTRACT = """
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const dir = './pg/migrations';
const migrations = Object.fromEntries(fs.readdirSync(dir).sort().map(name =>
  [name, createHash('sha256').update(fs.readFileSync(`${dir}/${name}`)).digest('hex')]));
console.log(JSON.stringify({queues: require('./runtime/queueNames'), migrations}));
"""


class ReleaseError(Exception):
    pass


class UncertainCommand(ReleaseError):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def parse_release(raw, app=None, *, bootstrap=False):
    require(isinstance(raw, dict) and set(raw) == {'app', 'commit', 'generation', 'attempt', 'config', 'images'},
            'Invalid release fields.')
    require(isinstance(raw['app'], str) and raw['app'] in APPS and (app is None or app == raw['app']),
            'Invalid release application.')
    require(isinstance(raw['commit'], str) and re.fullmatch(r'[a-f0-9]{40}', raw['commit']), 'Invalid commit.')
    order = (raw['generation'], raw['attempt'])
    require(all(type(value) is int for value in order) and
            (all(value > 0 for value in order) or (bootstrap and order == (0, 0))), 'Invalid run order.')
    require(isinstance(raw['config'], str) and HEX64.fullmatch(raw['config']), 'Invalid configuration hash.')
    roles = APPS[raw['app']]['roles']
    require(isinstance(raw['images'], dict) and set(raw['images']) == set(roles), 'Expected a complete image set.')
    for role, (package, _, _) in roles.items():
        item = raw['images'][role]
        require(isinstance(item, dict) and set(item) == {'source', 'image'}, 'Invalid image entry.')
        require(isinstance(item['source'], str) and HEX64.fullmatch(item['source']), 'Invalid component source hash.')
        pattern = rf'ghcr\.io/gen7fuel/{re.escape(package)}@sha256:[a-f0-9]{{64}}'
        require(isinstance(item['image'], str) and re.fullmatch(pattern, item['image']), 'Unexpected image repository or digest.')
    return raw


def config_hash(directory, filenames):
    checksums = ''.join(f'{hashlib.sha256((directory / name).read_bytes()).hexdigest()}  {name}\n' for name in filenames)
    return hashlib.sha256(checksums.encode()).hexdigest()


def sync_directory(path):
    directory = os.open(path, os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def write_state(file, value):
    temporary = file.with_suffix('.tmp')
    with temporary.open('w', encoding='utf-8') as stream:
        json.dump(value, stream)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(file)
    sync_directory(file.parent)


def command(args, *, env=None, timeout=60):
    try:
        return subprocess.run(args, env=env, timeout=timeout, capture_output=True, text=True, check=True).stdout
    except subprocess.TimeoutExpired:
        raise UncertainCommand(f'{args[0]} command timed out. Verify the VM state before retrying.') from None
    except (subprocess.SubprocessError, OSError) as error:
        raise ReleaseError(f'{args[0]} command failed ({type(error).__name__}).') from None


def disk_guard(run):
    definition = Path('/etc/gen7-data-disk.conf').read_text().strip()
    match = re.fullmatch(r'GEN7_DATA_DISK_UUID=([a-fA-F0-9-]+)', definition)
    require(match, 'Invalid managed disk mount configuration.')
    run(['/usr/local/libexec/gen7-verify-data-mount'], env={**os.environ, 'GEN7_DATA_DISK_UUID': match[1]})


class ComposeRelease:
    def __init__(self, app, config, state, run):
        self.app = app
        self.spec = APPS[app]
        self.state = state
        self.run = run
        self.env = {'PATH': os.environ['PATH'], 'HOME': '/root'}
        directory = config / app
        self.directory = directory
        self.cli = ['docker', 'compose', '--project-name', f'gen7-{app}', '--project-directory', str(directory),
                    '--env-file', str(directory / 'runtime.env')]
        for name in self.spec['compose']:
            self.cli.extend(['-f', str(directory / name)])

    def compose(self, release, *args, timeout=60):
        env = dict(self.env)
        for role, (_, key, _) in self.spec['roles'].items():
            env[key] = release['images'][role]['image']
        return self.run(self.cli + list(args), env=env, timeout=timeout)

    def docker(self, *args, timeout=60):
        return self.run(['docker', *args], env=self.env, timeout=timeout)

    def assert_running(self, release, roles):
        for role in roles:
            for service in self.spec['roles'][role][2]:
                ids = self.compose(release, 'ps', '--status', 'running', '-q', service).splitlines()
                require(len(ids) == 1, f'Expected exactly one running {service} owner.')
                image = self.docker('inspect', '--format', '{{.Config.Image}}', ids[0]).strip()
                require(image == release['images'][role]['image'], f'Running {service} differs from the recorded image.')

    def stop(self, release, services):
        self.compose(release, 'stop', '--timeout', '600', *services, timeout=660)
        for service in services:
            ids = self.compose(release, 'ps', '--all', '-q', service).splitlines()
            for container in ids:
                status = self.docker('inspect', '--format', '{{.State.Status}}', container).strip()
                if status not in ('exited', 'created'):
                    raise UncertainCommand(f'{service} did not reach a stopped state.')

    def start(self, release, services):
        if services:
            self.compose(release, 'up', '-d', '--no-deps', '--pull', 'never', '--wait', '--wait-timeout', '180',
                         *services, timeout=240)

    def queues(self, release, request, action):
        name = f"gen7-hub-queues-{request['generation']}-{request['attempt']}-{action}"
        checkpoint = self.state / 'queue-checkpoint'
        checkpoint.mkdir(mode=0o700, exist_ok=True)
        sync_directory(self.state)
        match = f'name=^/{name}$'
        require(not self.docker('ps', '--all', '--filter', match, '-q').strip(), 'Previous queue helper still exists.')
        try:
            output = self.compose(release, 'run', '--no-deps', '-T', '--rm', '--pull', 'never', '--name', name,
                                  '--volume', f'{checkpoint}:/checkpoint', 'backend', 'node',
                                  'scripts/runtime-cutover.cjs', action, timeout=660)
        finally:
            # The Compose client can exit while its named helper is still running on the daemon.
            if self.docker('ps', '--filter', match, '-q').strip():
                self.docker('stop', '--time', '10', name, timeout=30)
                require(not self.docker('ps', '--filter', match, '-q').strip(), 'Queue helper still owns Redis work.')
        expected = 'drained' if action == 'prepare' else 'resumed'
        reports = [line for line in output.splitlines() if line.startswith('{')]
        require(reports and json.loads(reports[-1]).get('phase') == expected, f'Queue {action} was not confirmed.')

    def promote(self, previous, request):
        roles = [role for role in self.spec['roles'] if previous['images'][role]['source'] != request['images'][role]['source']]
        services = tuple(service for role in roles for service in self.spec['roles'][role][2])
        image_set = {role: (request if role in roles else previous)['images'][role] for role in self.spec['roles']}
        selected = {**request, 'images': image_set}
        if not roles:
            return selected

        for role in roles:
            self.docker('pull', request['images'][role]['image'], timeout=300)
        rendered = json.loads(self.compose(selected, 'config', '--format', 'json'))['services']
        for role in roles:
            for service in self.spec['roles'][role][2]:
                require(rendered[service]['image'] == selected['images'][role]['image'], f'Unexpected image for {service}.')
        backend = self.app == 'hub' and 'backend' in roles
        if backend:
            require(not (self.state / 'queue-checkpoint').exists(), 'Existing Hub queue checkpoint requires review.')
            require(str(rendered['backend'].get('environment', {}).get('RUN_PG_MIGRATIONS', '')).lower() != 'true',
                    'Disable startup migrations before an automated backend deployment.')
            images = (previous['images']['backend']['image'], selected['images']['backend']['image'])
            contracts = [json.loads(self.docker('run', '--rm', '--pull', 'never', '--network', 'none',
                                                '--entrypoint', 'node', image, '-e', HUB_CONTRACT)) for image in images]
            require(contracts[0]['queues'] == contracts[1]['queues'], 'A queue inventory change requires a coordinated deployment.')
            require(contracts[0]['migrations'] == contracts[1]['migrations'], 'A database migration requires a coordinated deployment.')
        pending = self.state / 'pending.json'
        write_state(pending, {'previous': previous, 'requested': selected})
        if backend:
            self.queues(previous, request, 'prepare')
        web = tuple(service for service in services if service not in ('worker', 'scheduler'))
        try:
            if backend:
                self.stop(previous, ('scheduler', 'worker', 'backend'))
            self.start(selected, web)
            if backend:
                self.start(selected, ('worker',))
                self.start(selected, ('scheduler',))
            self.assert_running(selected, roles)
        except UncertainCommand:
            raise
        except ReleaseError:
            self.stop(previous, services)
            self.start(previous, web)
            if backend:
                self.start(previous, ('worker',))
                self.start(previous, ('scheduler',))
            self.assert_running(previous, roles)
            if backend:
                self.queues(previous, request, 'resume')
                (self.state / 'queue-checkpoint' / 'state.json').unlink()
                (self.state / 'queue-checkpoint').rmdir()
            pending.unlink()
            raise ReleaseError('Candidate failed. The previous images and queue state were restored.') from None
        if backend:
            self.queues(previous, request, 'resume')
        return selected


def deploy(request, *, config=Path('/etc/gen7-deploy'), state=Path('/var/lib/gen7-deploy'), run=command, verify_disk=disk_guard):
    os.umask(0o077)
    parse_release(request)
    app = request['app']
    with (state / 'deploy.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ReleaseError('Another deployment is active on the VM.') from None
        work = state / app
        pending = work / 'pending.json'
        require((config / app / 'enabled').is_file(), 'Deployment requires explicit host enablement.')
        require(not pending.exists() and not (work / 'queue-checkpoint').exists(), 'An unfinished release requires operator review.')
        verify_disk(run)
        target = ComposeRelease(app, config, work, run)
        require(config_hash(target.directory, target.spec['files']) == request['config'], 'Stage the reviewed VM configuration first.')
        active = work / 'active.json'
        previous = parse_release(json.loads(active.read_text()), app, bootstrap=True)
        require(previous['config'] == request['config'], 'Active release was verified against a different VM configuration.')
        current_order = (previous['generation'], previous['attempt'])
        next_order = (request['generation'], request['attempt'])
        require(next_order >= current_order, 'Release is older than the verified active release.')
        target.assert_running(previous, target.spec['roles'])
        if next_order == current_order:
            require(request['commit'] == previous['commit'] and request['config'] == previous['config'] and
                    all(item['source'] == previous['images'][role]['source'] for role, item in request['images'].items()),
                    'Run ID conflicts with the active release.')
        else:
            selected = target.promote(previous, request)
            write_state(active, selected)
            if (work / 'queue-checkpoint').exists():
                (work / 'queue-checkpoint' / 'state.json').unlink()
                (work / 'queue-checkpoint').rmdir()
            pending.unlink(missing_ok=True)
    print(f"GEN7_DEPLOY_OK {app} {request['generation']} {request['attempt']}")


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 2 and len(sys.argv[1]) < 8192, 'Expected one encoded release.')
        deploy(json.loads(base64.b64decode(sys.argv[1], validate=True)))
    except ReleaseError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f'Release could not be confirmed ({type(error).__name__}).', file=sys.stderr)
        sys.exit(1)
