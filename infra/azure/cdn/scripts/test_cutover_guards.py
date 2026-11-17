import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('cutover_config', Path(__file__).with_name('rehearse-cutover-config.py'))
module = importlib.util.module_from_spec(spec)
# Only validation functions are used. fcntl is unavailable on Windows clients.
with patch.dict(sys.modules, {'fcntl': SimpleNamespace()}):
    spec.loader.exec_module(module)


class StoppedProofTests(unittest.TestCase):
    def proof(self):
        return {'id': '/subscriptions/29b24248-1990-4592-b25d-e6ee8e9db784/resourceGroups/Gen7ERP/providers/Microsoft.Web/sites/gen7erp-cdn-prod-29b24248',
                'state': 'Stopped', 'observedAt': '2026-11-17T12:00:00Z'}

    def test_matching_fresh_stopped_site_can_fence_azure_for_standby(self):
        module.validate_stopped_azure(self.proof(), 'standby', 1794916810)

    def test_other_site_running_site_and_stale_evidence_cannot_fence_a_writer(self):
        for change in [{'id': '/another/site'}, {'state': 'Running'}, {'observedAt': '2026-11-16T12:00:00Z'}]:
            with self.assertRaises(AssertionError):
                module.validate_stopped_azure({**self.proof(), **change}, 'standby', 1794916810)

    def test_stopped_proof_cannot_activate_azure_itself(self):
        with self.assertRaises(AssertionError):
            module.validate_stopped_azure(self.proof(), 'azure', 1794916810)


if __name__ == '__main__':
    unittest.main()
