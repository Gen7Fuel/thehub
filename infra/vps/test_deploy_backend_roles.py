"""Fault injection for the rollout coordinator; Docker itself is rehearsed separately."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('rollout', Path(__file__).with_name('deploy-backend-roles.py'))
rollout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rollout)


class RolloutTests(unittest.TestCase):
    def exercise(self, failure=None, *, sage_secret='fixture-$previous', allow_rotation=False,
                 environment_overrides=None, reject_environment=False):
        self.events = []
        self.rollbacks = 0
        self.rollback_environment = None
        self.stop_calls = 0
        self.paused = False
        image = 'ghcr.io/gen7fuel/thehub-backend:'
        original = {'Config': {'Image': image + 'a' * 40, 'Env': ['REDIS_URL=redis://fixture', 'CDN_SERVICE_URL=https://fixture.invalid',
                                                               'SAGE_CLIENT_SECRET=fixture-$previous', 'SAGE_CLIENT_ID=fixture-client'],
                               'Labels': {'com.docker.compose.project': 'thehub', 'com.docker.compose.service': 'backend'}},
                    'NetworkSettings': {'Networks': {'thehub_default': {}}}, 'State': {'Running': True}}
        rendered = {service: {'image': image + 'b' * 40, 'command': ['node', entry],
                             'environment': {'REDIS_URL': 'redis://fixture', 'CDN_SERVICE_URL': 'https://fixture.invalid',
                                             'SAGE_CLIENT_SECRET': sage_secret, 'SAGE_CLIENT_ID': 'fixture-client'}}
                    for service, entry in [('backend', 'api.js'), ('worker', 'worker.js'), ('scheduler', 'scheduler.js')]}
        for service, overrides in (environment_overrides or {}).items():
            rendered[service]['environment'].update(overrides)

        def inspect(name, optional=False):
            if name.startswith('hub-runtime-cutover-'):
                return None
            if name in ['backend-worker', 'backend-scheduler']:
                return None
            return original

        def command(args, payload=None, timeout=180):
            if args[:3] == ['docker', 'compose', 'config']:
                return json.dumps({'services': rendered})
            if args[:3] == ['docker', 'run', '--rm']:
                self.assertEqual(args[args.index('--user') + 1], '1000:1000')
                action = args[-1]
                self.events.append(action)
                checkpoint = Path(args[args.index('-v') + 1].removesuffix(':/checkpoint')) / 'state.json'
                checkpoint.write_text(json.dumps({'phase': 'resumed' if action == 'resume' else 'drained'}))
                self.paused = action != 'resume'
                if failure == 'prepare' and action == 'prepare':
                    raise RuntimeError('Injected prepare failure')
            elif 'stop' in args:
                self.stop_calls += 1
                self.events.append('stop')
                if failure == 'stop-always' or (failure == 'stop-once' and self.stop_calls == 1):
                    raise RuntimeError('Injected partial stop failure')
                original['State']['Running'] = False
            elif 'up' in args:
                if payload:
                    self.rollbacks += 1
                    self.rollback_environment = json.loads(payload)['services']['backend']['environment']
                    assert not original['State']['Running'], 'Rollback overlapped existing runtime'
                    self.events.append('rollback')
                else:
                    self.events.append('up-' + args[-1])
                if failure == 'worker' and args[-1] == 'worker':
                    raise RuntimeError('Injected startup failure')
            elif args[:2] == ['docker', 'exec']:
                role = 'worker' if args[2] == 'backend-worker' else 'scheduler'
                return json.dumps({'role': role, 'ready': True, 'workers': ['queue'] * 15 if role == 'worker' else [],
                                   'schedules': ['cron'] * 18 if role == 'scheduler' else [], 'leader': role == 'scheduler'})
            return ''

        args = ['rollout', '--execute']
        if allow_rotation:
            args.append('--allow-sage-client-secret-rotation')
        with tempfile.TemporaryDirectory() as temp, patch.object(Path, 'home', return_value=Path(temp)), \
                patch.object(rollout, 'runtime_user', return_value='1000:1000'), \
                patch.object(rollout, 'inspect', side_effect=inspect), patch.object(rollout, 'command', side_effect=command), \
                patch.dict(os.environ, {'BACKEND_IMAGE': image + 'b' * 40, 'HUB_RUNTIME_DEPLOYMENT_ID': '123'}), \
                patch.object(sys, 'argv', args), contextlib.redirect_stdout(io.StringIO()):
            if failure or reject_environment:
                with self.assertRaises(RuntimeError):
                    rollout.main()
            else:
                rollout.main()
            if reject_environment:
                self.assertFalse(rollout.checkpoint_directory('123').exists())
                self.assertEqual(self.events, [])

    def test_success_resumes_only_after_all_roles_are_healthy(self):
        self.exercise()
        self.assertEqual(self.events, ['prepare', 'stop', 'up-backend', 'up-worker', 'up-scheduler', 'resume'])

    def test_sage_rotation_is_rejected_without_explicit_opt_in(self):
        self.exercise(sage_secret='fixture-next', reject_environment=True)

    def test_compose_escaped_sage_secret_does_not_count_as_drift(self):
        with patch.dict(os.environ, {'SAGE_CLIENT_SECRET': 'fixture-$previous'}):
            self.exercise(sage_secret='fixture-$$previous')
        self.assertEqual(self.events[-1], 'resume')

    def test_sage_rotation_can_replace_the_single_secret_with_opt_in(self):
        self.exercise(sage_secret='fixture-next', allow_rotation=True)
        self.assertEqual(self.events, ['prepare', 'stop', 'up-backend', 'up-worker', 'up-scheduler', 'resume'])

    def test_sage_rotation_rejects_blank_secret_and_mismatched_roles(self):
        for value in ['', '  ', None]:
            with self.subTest(value=value):
                self.exercise(sage_secret=value, allow_rotation=True, reject_environment=True)
        self.exercise(sage_secret='fixture-next', allow_rotation=True, reject_environment=True,
                      environment_overrides={'worker': {'SAGE_CLIENT_SECRET': 'different-fixture'}})

    def test_sage_rotation_rejects_additional_changes(self):
        self.exercise(sage_secret='fixture-next', allow_rotation=True, reject_environment=True,
                      environment_overrides={'scheduler': {'SAGE_CLIENT_ID': 'different-fixture'}})

    def test_sage_rotation_rollback_restores_previous_secret(self):
        self.exercise('worker', sage_secret='fixture-next', allow_rotation=True)
        self.assertEqual(self.events[-3:], ['stop', 'rollback', 'resume'])
        self.assertEqual(self.rollback_environment['SAGE_CLIENT_SECRET'], 'fixture-$$previous')
        self.assertEqual(self.rollback_environment['SAGE_CLIENT_ID'], 'fixture-client')

    def test_worker_start_failure_rolls_back_before_resuming(self):
        self.exercise('worker')
        self.assertEqual(self.events[-3:], ['stop', 'rollback', 'resume'])
        self.assertEqual(self.rollbacks, 1)

    def test_partial_initial_stop_requires_full_stop_and_rollback(self):
        self.exercise('stop-once')
        self.assertEqual(self.events, ['prepare', 'stop', 'stop', 'rollback', 'resume'])

    def test_failed_stop_never_starts_combined_backend_or_resumes(self):
        self.exercise('stop-always')
        self.assertTrue(self.paused)
        self.assertEqual(self.rollbacks, 0)
        self.assertNotIn('resume', self.events)

    def test_prepare_failure_restores_pause_flags_without_restarting_apps(self):
        self.exercise('prepare')
        self.assertEqual(self.events, ['prepare', 'resume'])

    def test_checkpoint_rejects_non_numeric_ids(self):
        for value in ['../123', '/tmp/123', '123/4', '']:
            with self.assertRaises(AssertionError):
                rollout.checkpoint_directory(value)

    def test_manual_recovery_stops_roles_and_verifies_backend_before_resuming(self):
        image = 'ghcr.io/gen7fuel/thehub-backend:'
        current = {'Config': {'Env': ['REDIS_URL=redis://fixture'], 'Labels': {
            'com.docker.compose.project': 'thehub', 'com.docker.compose.service': 'backend'}},
            'State': {'Running': False}, 'NetworkSettings': {'Networks': {'thehub_default': {}}}}
        events = []
        def inspect(name, optional=False):
            return None if optional else current
        def command(args, payload=None, timeout=180):
            if 'stop' in args: events.append('stop')
            elif 'up' in args:
                events.append('healthy-backend')
                self.assertEqual(json.loads(payload)['services']['backend']['command'], ['node', 'app.js'])
                self.assertEqual(json.loads(payload)['services']['backend']['image'], image + 'a' * 40)
                self.assertIn('--wait', args)
            elif args[:2] == ['docker', 'run']:
                self.assertEqual(args[args.index('--user') + 1], '1000:1000')
                events.append('resume')
            return ''
        with tempfile.TemporaryDirectory() as temp, patch.object(Path, 'home', return_value=Path(temp)), \
                patch.object(rollout, 'runtime_user', return_value='1000:1000'), \
                patch.object(rollout, 'inspect', side_effect=inspect), patch.object(rollout, 'command', side_effect=command), \
                patch.dict(os.environ, {}, clear=True), contextlib.redirect_stdout(io.StringIO()):
            directory = rollout.checkpoint_directory('123'); directory.mkdir(parents=True)
            (directory / 'operation.json').write_text(json.dumps({'previousImage': image + 'a' * 40,
                'helperImage': image + 'b' * 40, 'project': 'thehub', 'network': 'thehub_default'}))
            rollout.recover('123')
        self.assertEqual(events, ['stop', 'healthy-backend', 'resume'])


if __name__ == '__main__':
    unittest.main()
