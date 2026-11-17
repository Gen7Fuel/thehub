import ast
import base64
import importlib.util
from pathlib import Path
import re
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import urllib.request
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from nacl.public import PrivateKey, SealedBox

spec = importlib.util.spec_from_file_location('key_fence', Path(__file__).parents[1] / 'scripts' / 'deployment-key-fence.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        def public():
            return rsa.generate_private_key(public_exponent=65537, key_size=2048).public_key().public_bytes(
                serialization.Encoding.OpenSSH, serialization.PublicFormat.OpenSSH).decode()
        cls.old, cls.personal, cls.new = public(), public(), public()

    def setUp(self):
        self.legacy = module.fingerprint(self.old)
        self.protected = module.fingerprint(self.personal)
        self.new_fp = module.fingerprint(self.new)
        self.enterContext(patch.object(module, 'LEGACY', self.legacy))
        self.enterContext(patch.object(module, 'PROTECTED', self.protected))
        self.original = '# keep this comment\n' + self.old + ' legacy\n\n' + self.personal + " person's working key\n"
        self.public = 'restrict ' + self.new + ' github-actions-hub-vps-v2'

    def test_fingerprint_ignores_options_and_arbitrary_comment_quotes(self):
        self.assertEqual(module.fingerprint(self.personal + " person's key"), self.protected)
        self.assertEqual(module.fingerprint('restrict ' + self.new), self.new_fp)

    def test_stage_preserves_every_existing_line_and_restricts_new_key(self):
        staged = module.rewrite_keys(self.original, 'stage', self.new_fp, self.public)
        self.assertTrue(staged.startswith(self.original))
        self.assertEqual(staged, self.original + self.public + '\n')

    def test_retirement_removes_only_legacy_and_preserves_personal_key_and_comments(self):
        staged = module.rewrite_keys(self.original, 'stage', self.new_fp, self.public)
        retired = module.rewrite_keys(staged, 'retire', self.new_fp)
        self.assertEqual(retired, self.original.replace(self.old + ' legacy\n', '') + self.public + '\n')
        self.assertIn(self.protected, [fp for _, fp in module.key_rows(retired)])

    def test_no_retirement_without_both_replacement_and_personal_access(self):
        with self.assertRaises(AssertionError):
            module.rewrite_keys(self.original, 'retire', self.new_fp)
        with self.assertRaises(AssertionError):
            module.rewrite_keys(self.old + '\n' + self.public + '\n', 'retire', self.new_fp)

    def test_stage_cannot_overwrite_protected_key_or_accept_mismatched_public_key(self):
        for fp in [self.protected, self.legacy, 'SHA256:wrong']:
            with self.assertRaises(AssertionError):
                module.rewrite_keys(self.original, 'stage', fp, self.public)

    def test_failed_stage_can_remove_only_new_key_before_legacy_retirement(self):
        staged = module.rewrite_keys(self.original, 'stage', self.new_fp, self.public)
        self.assertEqual(module.rewrite_keys(staged, 'remove-staged', self.new_fp), self.original)
        retired = module.rewrite_keys(staged, 'retire', self.new_fp)
        with self.assertRaises(AssertionError):
            module.rewrite_keys(retired, 'remove-staged', self.new_fp)

    def test_secret_encryption_roundtrip_never_sends_plaintext_to_api(self):
        private = PrivateKey.generate()
        requests = []
        operator = object.__new__(module.Operator)
        def api(path, method='GET', body=None):
            if path.endswith('/public-key'):
                return {'key_id': 'synthetic-id', 'key': base64.b64encode(bytes(private.public_key)).decode()}
            requests.append((path, body))
            return {}
        operator.api = api
        operator.put_secret('SYNTHETIC_SECRET', 'synthetic-private-value')
        body = requests[0][1]
        self.assertNotIn('synthetic-private-value', str(body))
        self.assertEqual(SealedBox(private).decrypt(base64.b64decode(body['encrypted_value'])), b'synthetic-private-value')

    def test_artifact_redirect_does_not_forward_github_credentials(self):
        request = urllib.request.Request('https://api.github.com/artifact', headers={'Authorization': 'Bearer synthetic'})
        result = module.NoCredentialRedirect().redirect_request(request, None, 302, '', {}, 'https://example.invalid/archive.zip')
        self.assertIsNone(result.get_header('Authorization'))

    def test_generated_remote_scripts_parse_and_recognize_both_sshd_process_names(self):
        operator = object.__new__(module.Operator)
        scripts = []
        def remote(code, sudo=False):
            ast.parse(code); scripts.append(code); return {}
        operator.remote = remote
        operator.server()
        operator.edit_server('stage', self.new_fp, self.public)
        operator.authorization_proof(self.new_fp, '2026-11-17T00:00:00Z')
        tree = ast.parse(scripts[-1])
        pattern = next(node.args[0].value for node in ast.walk(tree) if isinstance(node, ast.Call)
                       and isinstance(node.func, ast.Attribute) and node.func.attr == 'search')
        self.assertEqual(re.search(pattern, 'host sshd[42]: Accepted publickey').group(1), '42')
        self.assertEqual(re.search(pattern, 'host sshd-session[43]: Accepted publickey').group(1), '43')

    def test_workflow_contract_rejects_legacy_or_unscoped_credentials(self):
        import yaml
        workflow = {'jobs': {
            'check-changes': {'if': "github.ref == 'refs/heads/main'"},
            'deploy': {'environment': module.ENVIRONMENT,
                       'if': "github.ref == 'refs/heads/main' && needs.check-changes.outputs.backend == 'true'",
                       'steps': [{'with': {'key': '${{ secrets.HUB_DEPLOY_SSH_KEY_V2 }}',
                                           'fingerprint': '${{ vars.HUB_DEPLOY_HOST_FINGERPRINT_V2 }}'}} for _ in range(2)]}}}
        text = yaml.safe_dump(workflow)
        module.workflow_contract(text)
        for invalid in [text.replace(module.ENVIRONMENT, 'another-environment'),
                        text.replace('secrets.HUB_DEPLOY_SSH_KEY_V2', 'secrets.SERVER_SSH_KEY', 1),
                        text.replace('refs/heads/main', 'refs/heads/unreviewed')]:
            with self.assertRaises(AssertionError):
                module.workflow_contract(invalid)

    def test_optimized_python_cannot_bypass_cli_safety_checks(self):
        with patch.object(module.sys, 'flags', SimpleNamespace(optimize=1)):
            with self.assertRaises(RuntimeError):
                module.main()


if __name__ == '__main__':
    unittest.main()
