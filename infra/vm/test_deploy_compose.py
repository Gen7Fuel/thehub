import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest


spec = importlib.util.spec_from_file_location('deploy_compose', Path(__file__).with_name('deploy-compose.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class Fixture:
    def __init__(self, root, app):
        self.app = app
        self.root = root
        self.config = root / 'config'
        self.state = root / 'state'
        self.work = self.state / app
        self.work.mkdir(parents=True)
        (self.config / app).mkdir(parents=True)
        (self.config / app / 'enabled').touch()
        for filename in release.APPS[app]['files']:
            path = self.config / app / filename
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f'synthetic {filename}\n')
        self.roles = release.APPS[app]['roles']
        self.previous = self.manifest(1, 'a')
        self.active = self.work / 'active.json'
        self.active.write_text(json.dumps(self.previous))
        self.running = {service: self.previous['images'][role]['image']
                        for role, (_, _, services) in self.roles.items() for service in services}
        self.stopped = {}
        self.helpers = set()
        self.calls = []
        self.fail_at = None
        self.timeout_at = None
        self.prepare_timeout = False
        self.restarting = None
        self.resume_fails = False
        self.queue_inventory_changes = False
        self.migrations_change = False

    def manifest(self, generation, fill):
        return {
            'app': self.app, 'commit': fill * 40, 'generation': generation, 'attempt': 1,
            'config': release.config_hash(self.config / self.app, release.APPS[self.app]['files']),
            'images': {role: {'source': fill * 64, 'image': f'ghcr.io/gen7fuel/{image}@sha256:{fill * 64}'}
                       for role, (image, _, _) in self.roles.items()},
        }

    def request(self, *changed):
        request = self.manifest(2, 'b')
        for role in self.roles.keys() - set(changed):
            request['images'][role]['source'] = self.previous['images'][role]['source']
        return request

    def run(self, args, *, env=None, timeout=0):
        if args[:2] == ['docker', 'inspect']:
            if args[-2] == '{{.State.Status}}':
                return self.stopped.get(args[-1], 'running')
            return self.running[args[-1]]
        if args[:2] == ['docker', 'ps']:
            name = args[args.index('--filter') + 1].removeprefix('name=^/').removesuffix('$')
            return name if name in self.helpers else ''
        if args[:2] == ['docker', 'stop']:
            self.calls.append(('helper-stop', args[-1]))
            self.helpers.remove(args[-1])
            return ''
        if args[:2] == ['docker', 'pull']:
            self.calls.append(('pull', args[-1]))
            return ''
        if args[:2] == ['docker', 'run']:
            assert '--network' in args and 'none' in args
            names = ['fixture-email']
            new = f'sha256:{"b" * 64}' in ' '.join(args)
            if self.queue_inventory_changes and new:
                names.append('fixture-unreviewed')
            return json.dumps({'queues': names, 'migrations': {'fixture.js': 'changed' if self.migrations_change and new else 'original'}})
        assert args[:2] == ['docker', 'compose']
        operation = next(name for name in ('ps', 'config', 'up', 'stop', 'run') if name in args)
        if operation == 'ps':
            if args[-1] in self.running or ('--all' in args and args[-1] in self.stopped):
                return args[-1]
            return ''
        if operation == 'config':
            return json.dumps({'services': {service: {'image': env[key]}
                               for _, key, services in self.roles.values() for service in services}})
        if operation == 'run':
            phase = args[-1]
            self.calls.append(('queue', phase))
            if phase == 'prepare' and self.prepare_timeout:
                self.helpers.add(args[args.index('--name') + 1])
                raise release.UncertainCommand('Synthetic queue helper timeout')
            if self.resume_fails and phase == 'resume':
                raise release.ReleaseError('Synthetic queue resume error')
            (self.work / 'queue-checkpoint/state.json').write_text('{}')
            return json.dumps({'phase': 'drained' if phase == 'prepare' else 'resumed'})
        if operation == 'stop':
            services = args[args.index('600') + 1:]
            self.calls.append(('stop', *services))
            for service in services:
                self.running.pop(service, None)
                self.stopped[service] = 'restarting' if service == self.restarting else 'exited'
            return ''
        assert '--no-deps' in args and '--wait' in args and '--pull' in args
        services = args[args.index('180') + 1:]
        self.calls.append(('up', *services))
        for _, key, targets in self.roles.values():
            for service in targets:
                if service in services:
                    self.running[service] = env[key]
                    self.stopped.pop(service, None)
        if self.timeout_at in services:
            raise release.UncertainCommand('Synthetic Docker client timeout')
        if self.fail_at in services:
            self.fail_at = None
            raise release.ReleaseError('Synthetic container health failure')
        return ''

    def deploy(self, request, verify_disk=lambda _: None):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            release.deploy(request, config=self.config, state=self.state, run=self.run, verify_disk=verify_disk)
        return output.getvalue().strip()


class DeployComposeTests(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)

    def test_hub_frontend_preserves_api_auth_and_worker_images(self):
        fixture = Fixture(self.root, 'hub')
        request = fixture.request('frontend')
        self.assertEqual(fixture.deploy(request), 'GEN7_DEPLOY_OK hub 2 1')
        self.assertEqual([call for call in fixture.calls if call[0] != 'pull'], [('up', 'frontend')])
        self.assertEqual(fixture.running['backend'], fixture.previous['images']['backend']['image'])
        self.assertEqual(fixture.running['worker'], fixture.running['backend'])
        self.assertEqual(fixture.deploy(request), 'GEN7_DEPLOY_OK hub 2 1')
        self.assertEqual(len(fixture.calls), 2)

    def test_hub_backend_drains_and_resumes_before_committing(self):
        fixture = Fixture(self.root, 'hub')
        fixture.deploy(fixture.request('backend'))
        self.assertEqual(fixture.calls[1:], [
            ('queue', 'prepare'), ('stop', 'scheduler', 'worker', 'backend'), ('up', 'backend'),
            ('up', 'worker'), ('up', 'scheduler'), ('queue', 'resume'),
        ])
        self.assertFalse((fixture.work / 'pending.json').exists())
        self.assertFalse((fixture.work / 'queue-checkpoint').exists())

    def test_failed_hub_rollout_restores_previous_split_images_and_queues(self):
        fixture = Fixture(self.root, 'hub')
        running = dict(fixture.running)
        fixture.fail_at = 'worker'
        with self.assertRaisesRegex(release.ReleaseError, 'previous images and queue state were restored'):
            fixture.deploy(fixture.request('backend', 'auth'))
        self.assertEqual(fixture.running, running)
        self.assertEqual(json.loads(fixture.active.read_text()), fixture.previous)
        self.assertEqual(fixture.calls[-1], ('queue', 'resume'))
        self.assertFalse((fixture.work / 'pending.json').exists())

    def test_failed_queue_resume_leaves_recovery_journal(self):
        fixture = Fixture(self.root, 'hub')
        fixture.resume_fails = True
        with self.assertRaisesRegex(release.ReleaseError, 'resume error'):
            fixture.deploy(fixture.request('backend'))
        self.assertTrue((fixture.work / 'pending.json').exists())

    def test_timed_out_queue_helper_is_stopped_and_journal_remains(self):
        fixture = Fixture(self.root, 'hub')
        fixture.prepare_timeout = True
        with self.assertRaisesRegex(release.UncertainCommand, 'helper timeout'):
            fixture.deploy(fixture.request('backend'))
        self.assertFalse(fixture.helpers)
        self.assertEqual(fixture.calls[-1], ('helper-stop', 'gen7-hub-queues-2-1-prepare'))
        self.assertTrue((fixture.work / 'pending.json').exists())

    def test_docker_timeout_does_not_assume_a_rollback_is_safe(self):
        fixture = Fixture(self.root, 'desk')
        fixture.timeout_at = 'api'
        with self.assertRaisesRegex(release.UncertainCommand, 'client timeout'):
            fixture.deploy(fixture.request('backend'))
        self.assertEqual(fixture.calls[-1], ('up', 'api'))
        self.assertTrue((fixture.work / 'pending.json').exists())

    def test_restarting_owner_blocks_replacement(self):
        fixture = Fixture(self.root, 'hub')
        fixture.restarting = 'worker'
        with self.assertRaisesRegex(release.UncertainCommand, 'worker did not reach a stopped state'):
            fixture.deploy(fixture.request('backend'))
        self.assertEqual(fixture.calls[-1], ('stop', 'scheduler', 'worker', 'backend'))
        self.assertTrue((fixture.work / 'pending.json').exists())
        with self.assertRaisesRegex(release.ReleaseError, 'unfinished release'):
            fixture.deploy(fixture.request('backend'))

    def test_desk_deploy_leaves_backup_and_database_alone(self):
        fixture = Fixture(self.root, 'desk')
        fixture.running.update({'cdn-backup': 'backup-fixture', 'db': 'database-fixture'})
        self.assertEqual(fixture.deploy(fixture.request('backend', 'frontend')), 'GEN7_DEPLOY_OK desk 2 1')
        self.assertEqual(fixture.calls[-1], ('up', 'api', 'caddy'))
        self.assertEqual(fixture.running['cdn-backup'], 'backup-fixture')
        self.assertEqual(fixture.running['db'], 'database-fixture')

    def test_disabled_or_fenced_owner_never_starts(self):
        fixture = Fixture(self.root, 'hub')
        marker = fixture.config / 'hub/enabled'
        marker.unlink()
        with self.assertRaisesRegex(release.ReleaseError, 'enablement'):
            fixture.deploy(fixture.request('backend'))
        marker.touch()
        fixture.running.pop('worker')
        with self.assertRaisesRegex(release.ReleaseError, 'running worker owner'):
            fixture.deploy(fixture.request('backend'))
        self.assertEqual(fixture.calls, [])

    def test_config_disk_digest_and_order_fail_closed(self):
        fixture = Fixture(self.root, 'desk')
        request = fixture.request('backend')
        wrong_digest = copy.deepcopy(request)
        wrong_digest['images']['backend']['image'] = 'ghcr.io/gen7fuel/desk-api:latest'
        with self.assertRaisesRegex(release.ReleaseError, 'digest'):
            fixture.deploy(wrong_digest)
        wrong_config = {**request, 'config': 'f' * 64}
        with self.assertRaisesRegex(release.ReleaseError, 'Stage the reviewed'):
            fixture.deploy(wrong_config)

        def bad_disk(_):
            raise release.ReleaseError('Synthetic disk mismatch')

        with self.assertRaisesRegex(release.ReleaseError, 'disk mismatch'):
            fixture.deploy(request, bad_disk)
        fixture.deploy(request)
        with self.assertRaisesRegex(release.ReleaseError, 'older'):
            fixture.deploy(fixture.previous)

    def test_queue_inventory_change_is_blocked_before_pause(self):
        fixture = Fixture(self.root, 'hub')
        fixture.queue_inventory_changes = True
        with self.assertRaisesRegex(release.ReleaseError, 'queue inventory change'):
            fixture.deploy(fixture.request('backend'))
        self.assertTrue(all(call[0] == 'pull' for call in fixture.calls))

    def test_new_database_migration_is_blocked_before_pause(self):
        fixture = Fixture(self.root, 'hub')
        fixture.migrations_change = True
        with self.assertRaisesRegex(release.ReleaseError, 'database migration'):
            fixture.deploy(fixture.request('backend'))
        self.assertTrue(all(call[0] == 'pull' for call in fixture.calls))


if __name__ == '__main__':
    unittest.main()
