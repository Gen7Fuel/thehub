import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('routing_plan', Path(__file__).with_name('routing-plan.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RoutingPlanTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.state = Path(self.directory.name) / 'state.json'

    def write(self, target):
        self.state.write_text(json.dumps({'version': 1, 'target': target}))

    def test_existing_vps_needs_no_new_setting(self):
        self.assertEqual(module.plan(self.state, '', ''), {'CDN_PUBLIC_UPSTREAM': 'cdn:5001'})
        self.assertEqual(module.plan(self.state, 'vps', 'http://cdn:5001/'), {'CDN_PUBLIC_UPSTREAM': 'cdn:5001'})

    def test_azure_and_same_storage_standby(self):
        for target, (_, service, upstream) in module.TARGETS.items():
            self.write(target)
            self.assertEqual(module.plan(self.state, 'vps' if target == 'legacy' else 'azure', service),
                             {'CDN_PUBLIC_UPSTREAM': upstream})

    def test_missing_state_cannot_recreate_old_storage_after_cutover(self):
        with self.assertRaises(ValueError):
            module.plan(self.state, 'azure', module.AZURE)

    def test_stale_workflow_cannot_undo_routing_or_recreate_old_cdn(self):
        self.write('standby')
        for deploy, service in [('vps', ''), ('azure', module.AZURE), ('azure', '')]:
            with self.assertRaises(ValueError):
                module.plan(self.state, deploy, service)

    def test_freeze_blocks_all_targets(self):
        for target, (deploy, service, _) in module.TARGETS.items():
            self.write(target)
            with self.assertRaises(ValueError):
                module.plan(self.state, deploy, service, frozen=True)

    def test_malformed_state_and_unexpected_targets_fail_closed(self):
        for value in [{}, {'version': 2, 'target': 'azure'}, {'version': 1, 'target': 'evil; command'}, []]:
            self.state.write_text(json.dumps(value))
            with self.assertRaises((ValueError, AttributeError)):
                module.plan(self.state, 'vps', '')

    def test_frontend_only_deploy_cannot_apply_endpoint_change_without_backend(self):
        with self.assertRaises(ValueError):
            module.validate_backend('', module.AZURE, False)
        module.validate_backend('', module.AZURE, True)
        module.validate_backend(module.AZURE + '/', module.AZURE, False)
        module.validate_backend('', 'http://cdn:5001', False)


if __name__ == '__main__':
    unittest.main()
