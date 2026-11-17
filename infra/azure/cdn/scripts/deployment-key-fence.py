"""Operator-only Hub SSH credential migration. Default audit is read-only.

Run with the installed Azure CLI Python (PyNaCl, cryptography, Paramiko, PyYAML).
Private keys and GitHub tokens remain in memory. Nothing deploys applications.
Stage/retire require --execute, the merged workflow contract and deployment freeze.
"""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import inspect
import io
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

ENVIRONMENT = 'hub-vps-production-v2'
SECRET = 'HUB_DEPLOY_SSH_KEY_V2'
LEGACY = 'SHA256:7w8AVaiYcjTXsl/LYcIaO0a2wNSS0hyxCSfmpbc8+PY'
PROTECTED = 'SHA256:sNUPGZ5sUEiFRdqkLwRSxuFXwoBAeOBYXGwpKBDWN7s'
HOST, USER = 'app.gen7fuel.com', 'gen7fuel'
BASE = 'https://api.github.com/repos/Gen7Fuel/thehub'


def fingerprint(line):
    fields = shlex.shlex(line, posix=True)
    fields.whitespace_split = True
    fields.commenters = ''
    for value in fields:
        if value.startswith(('ssh-', 'ecdsa-', 'sk-')):
            raw = base64.b64decode(next(fields), validate=True)
            break
    else:
        raise ValueError('No public key found')
    return 'SHA256:' + base64.b64encode(hashlib.sha256(raw).digest()).decode().rstrip('=')


def key_rows(text):
    return [(line, fingerprint(line)) for line in text.splitlines(keepends=True)
            if line.strip() and not line.lstrip().startswith('#')]


def rewrite_keys(text, action, new_fingerprint, public_line=None):
    assert new_fingerprint not in (LEGACY, PROTECTED)
    rows = key_rows(text)
    values = [value for _, value in rows]
    assert PROTECTED in values, 'Working operator/Desk key must be preserved'
    if action == 'stage':
        assert LEGACY in values and new_fingerprint not in values
        assert fingerprint(public_line) == new_fingerprint
        assert public_line.startswith('restrict ssh-rsa ')
        return text + ('' if text.endswith('\n') else '\n') + public_line.strip() + '\n'
    assert new_fingerprint in values, 'Verified replacement key missing'
    if action == 'retire':
        assert values.count(LEGACY) == 1
        return ''.join(line for line in text.splitlines(keepends=True)
                       if not line.strip() or line.lstrip().startswith('#') or fingerprint(line) != LEGACY)
    assert action == 'remove-staged' and LEGACY in values
    return ''.join(line for line in text.splitlines(keepends=True)
                   if not line.strip() or line.lstrip().startswith('#') or fingerprint(line) != new_fingerprint)


def workflow_contract(text):
    import yaml
    document = yaml.safe_load(text)
    job = document['jobs']['deploy']
    assert job['environment'] == ENVIRONMENT
    assert document['jobs']['check-changes']['if'] == "github.ref == 'refs/heads/main'"
    assert "github.ref == 'refs/heads/main'" in job['if']
    keys = [step['with'] for step in job['steps'] if 'key' in step.get('with', {})]
    assert len(keys) == 2
    assert all(value['key'] == '${{ secrets.HUB_DEPLOY_SSH_KEY_V2 }}' for value in keys)
    assert all(value.get('fingerprint') == '${{ vars.HUB_DEPLOY_HOST_FINGERPRINT_V2 }}' for value in keys)
    assert 'secrets.SERVER_SSH_KEY' not in text, 'Legacy credential reference remains'
    assert 'needs.check-changes.outputs.backend' in job['if'], 'Application-selection guard required'


class NoCredentialRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        result = super().redirect_request(req, fp, code, msg, headers, newurl)
        if result:
            result.remove_header('Authorization')
        return result


class Operator:
    def __init__(self):
        result = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n',
            text=True, capture_output=True, check=True, timeout=30,
            env={**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'GCM_INTERACTIVE': 'Never'})
        self.token = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)['password']
        self.opener = urllib.request.build_opener(NoCredentialRedirect())

    def api(self, path, method='GET', body=None, optional=False, binary=False):
        request = urllib.request.Request(BASE + path, method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization': 'Bearer ' + self.token, 'Accept': 'application/vnd.github+json',
                     'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10'})
        try:
            with self.opener.open(request, timeout=30) as response:
                value = response.read()
                return value if binary else json.loads(value) if value else {}
        except urllib.error.HTTPError as error:
            if optional and error.code == 404:
                return None
            raise RuntimeError('GitHub request failed with status ' + str(error.code)) from None

    def remote(self, code, sudo=False):
        code = "import sys\nif sys.flags.optimize: raise SystemExit('Optimized Python is not supported')\n" + code
        result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15',
                                 USER + '@' + HOST, ('sudo -n ' if sudo else '') + 'python3 -'],
                                input=code, text=True, capture_output=True, timeout=45)
        assert result.returncode == 0, 'Remote operator check failed'
        return json.loads(result.stdout)

    def server(self):
        code = 'import json,base64,hashlib,shlex,pathlib\n' + inspect.getsource(fingerprint) + inspect.getsource(key_rows) + r'''
p=pathlib.Path.home()/'.ssh'/'authorized_keys'
hosts=[]
for name in pathlib.Path('/etc/ssh').glob('ssh_host_*_key.pub'):
 fields=name.read_text().split();public=' '.join(fields[:2]);hosts.append({'public':public,'fingerprint':fingerprint(public),'type':fields[0]})
print(json.dumps({'fingerprints':[value for _,value in key_rows(p.read_text())],'hostKeys':hosts,'alternateKeys':(p.parent/'authorized_keys2').exists()}))
'''
        return self.remote(code)

    def assert_personal_access(self):
        result = subprocess.run(['ssh', '-v', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15',
                                 USER + '@' + HOST, 'true'], text=True, capture_output=True, timeout=30)
        accepted = [line for line in result.stderr.splitlines() if 'Server accepts key:' in line]
        assert result.returncode == 0 and any(PROTECTED in line for line in accepted), 'Use the audited working personal key'

    def edit_server(self, action, new_fp, public=None):
        payload = base64.b64encode(json.dumps({'action': action, 'new': new_fp, 'public': public}).encode()).decode()
        code = 'import json,base64,hashlib,shlex,pathlib,os,tempfile,fcntl\n'
        code += f'LEGACY={LEGACY!r}\nPROTECTED={PROTECTED!r}\n'
        code += inspect.getsource(fingerprint) + inspect.getsource(key_rows) + inspect.getsource(rewrite_keys)
        code += f'v=json.loads(base64.b64decode({payload!r}))\n' + r'''
p=pathlib.Path.home()/'.ssh'/'authorized_keys'
assert not p.is_symlink() and p.stat().st_uid==os.getuid()
with (p.parent/'.hub-key-edit.lock').open('a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 original=p.read_text();updated=rewrite_keys(original,v['action'],v['new'],v['public'])
 with tempfile.NamedTemporaryFile(mode='w',dir=p.parent,prefix='.authorized_keys.',delete=False) as file:
  temp=pathlib.Path(file.name);os.fchmod(file.fileno(),0o600);file.write(updated);file.flush();os.fsync(file.fileno())
 try:
  assert p.read_text()==original,'Concurrent authorized_keys edit'
  os.replace(temp,p)
 finally:
  if temp.exists():temp.unlink()
 rows=[value for _,value in key_rows(p.read_text())]
 print(json.dumps({'legacyPresent':LEGACY in rows,'replacementPresent':v['new'] in rows,'operatorPreserved':PROTECTED in rows}))
'''
        return self.remote(code)

    def guard(self):
        workflow = self.api('/contents/.github/workflows/main.yml?ref=main')
        workflow_contract(base64.b64decode(workflow['content']).decode())
        assert self.api('/actions/secrets/' + SECRET, optional=True) is None, 'Replacement credential must remain environment-only'
        assert self.api('/actions/variables/CDN_MIGRATION_FREEZE')['value'] == 'true', 'Freeze deployments first'
        for status in ['queued', 'in_progress', 'waiting', 'pending', 'requested']:
            active = self.api('/actions/workflows/main.yml/runs?per_page=100&status=' + status)
            assert active['total_count'] <= 100, 'Too many active deployments to validate'
            for run in active['workflow_runs']:
                jobs = self.api(f"/actions/runs/{run['id']}/jobs?filter=all")
                assert run['id'] == 43096158541 and run['head_sha'] == '2022a20c5aa9d3fd3051ae808d9a4da8c8009f98' and run['status'] == 'queued' and jobs['total_count'] == 0, 'Another deployment is active'
        self.assert_personal_access()

    def variable(self, name, value):
        prefix = '/environments/' + ENVIRONMENT + '/variables'
        previous = self.api(prefix + '/' + name, optional=True)
        self.api(prefix + ('/' + name if previous else ''), 'PATCH' if previous else 'POST', {'name': name, 'value': value})

    def put_secret(self, name, value, environment=True):
        from nacl.public import PublicKey, SealedBox
        prefix = '/environments/' + ENVIRONMENT + '/secrets' if environment else '/actions/secrets'
        key = self.api(prefix + '/public-key')
        sealed = SealedBox(PublicKey(base64.b64decode(key['key']))).encrypt(value.encode())
        self.api(prefix + '/' + name, 'PUT', {'key_id': key['key_id'], 'encrypted_value': base64.b64encode(sealed).decode()})

    def stage(self):
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        import paramiko
        self.guard()
        state = self.server()
        assert LEGACY in state['fingerprints'] and PROTECTED in state['fingerprints']
        assert self.api('/actions/secrets/' + SECRET, optional=True) is None, 'New credential must be environment-only'
        existing = self.api('/environments/' + ENVIRONMENT, optional=True)
        assert existing is None, 'Replacement environment already exists; inspect instead of overwriting credentials'
        private = rsa.generate_private_key(public_exponent=65537, key_size=4096)
        pem = private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()).decode()
        public = private.public_key().public_bytes(serialization.Encoding.OpenSSH, serialization.PublicFormat.OpenSSH).decode()
        new_fp = fingerprint(public)
        self.api('/environments/' + ENVIRONMENT, 'PUT', {'deployment_branch_policy': {'protected_branches': False, 'custom_branch_policies': True}})
        self.api('/environments/' + ENVIRONMENT + '/deployment-branch-policies', 'POST', {'name': 'main', 'type': 'branch'})
        appended = False
        try:
            self.edit_server('stage', new_fp, 'restrict ' + public + ' github-actions-hub-vps-v2'); appended = True
            client = paramiko.SSHClient(); client.set_missing_host_key_policy(paramiko.RejectPolicy())
            for entry in state['hostKeys']:
                row = paramiko.hostkeys.HostKeyEntry.from_line(HOST + ' ' + entry['public'])
                client.get_host_keys().add(HOST, row.key.get_name(), row.key)
            key = paramiko.RSAKey.from_private_key(io.StringIO(pem))
            try:
                client.connect(HOST, username=USER, pkey=key, allow_agent=False, look_for_keys=False, timeout=20, auth_timeout=20)
                _, stdout, _ = client.exec_command('printf hub_vps_key_probe_ok', timeout=20)
                assert stdout.read() == b'hub_vps_key_probe_ok' and stdout.channel.recv_exit_status() == 0
            finally:
                client.close()
            self.put_secret(SECRET, pem)
            preferred = next(row for row in state['hostKeys'] if row['type'] == 'ecdsa-sha2-nistp256')
            self.variable('HUB_DEPLOY_KEY_FINGERPRINT_V2', new_fp)
            self.variable('HUB_DEPLOY_HOST_FINGERPRINT_V2', preferred['fingerprint'])
        except Exception:
            if appended:
                self.edit_server('remove-staged', new_fp)
            raise
        return {'stageComplete': True, 'environment': ENVIRONMENT, 'newFingerprint': new_fp,
                'legacyKeyRetained': True, 'personalAndDeskKeyUnchanged': True, 'privateKeyFilesWritten': 0,
                'next': 'Run the main-only SSH/SCP probe before retirement'}

    def authorization_proof(self, new_fp, since):
        code = 'import json,subprocess,pathlib,re,datetime\n' + f'new_fp={new_fp!r}\nsince={since!r}\nlegacy={LEGACY!r}\n' + r'''
configs=[pathlib.Path('/etc/ssh/sshd_config'),*pathlib.Path('/etc/ssh/sshd_config.d').glob('*.conf')]
for config in configs:
 for line in config.read_text().splitlines():
  fields=line.split()
  if not fields or fields[0].startswith('#'):continue
  assert fields[0].lower()!='match','Conditional SSH authorization requires review'
  if fields[0].lower()=='include':assert fields[1:]==['/etc/ssh/sshd_config.d/*.conf'],'Additional SSH include requires review'
r=subprocess.run(['/usr/sbin/sshd','-T'],capture_output=True,text=True,check=True)
values=dict(line.split(' ',1) for line in r.stdout.splitlines() if ' ' in line)
assert values.get('authorizedkeyscommand')=='none' and values.get('trustedusercakeys')=='none'
assert values.get('authorizedkeysfile')=='.ssh/authorized_keys .ssh/authorized_keys2'
assert not pathlib.Path('/home/gen7fuel/.ssh/authorized_keys2').exists()
observed=False;active=0
for path in [pathlib.Path('/var/log/auth.log'),pathlib.Path('/var/log/auth.log.1')]:
 if not path.exists():continue
 for line in path.open(errors='replace'):
  if 'Accepted publickey for gen7fuel ' not in line:continue
  if new_fp in line:
   try:observed=observed or datetime.datetime.fromisoformat(line.split()[0]).timestamp()>=datetime.datetime.fromisoformat(since.replace('Z','+00:00')).timestamp()
   except ValueError:pass
  if legacy in line:
   match=re.search(r'sshd(?:-session)?\[(\d+)\]',line)
   if match:
    proc=pathlib.Path('/proc')/match.group(1)/'comm'
    try:active+=int(proc.read_text().strip().startswith('sshd'))
    except FileNotFoundError:pass
print(json.dumps({'newKeyAuthenticatedSinceProbe':observed,'activeLegacySessions':active,'onlyAuditedAuthorizationSources':True}))
'''
        return self.remote(code, sudo=True)

    def retire(self, run_id):
        self.guard()
        env = self.api('/environments/' + ENVIRONMENT)
        assert env['deployment_branch_policy'] == {'protected_branches': False, 'custom_branch_policies': True}
        policies = self.api('/environments/' + ENVIRONMENT + '/deployment-branch-policies')['branch_policies']
        assert len(policies) == 1 and policies[0]['name'] == 'main' and policies[0]['type'] == 'branch'
        variables = {v['name']: v['value'] for v in self.api('/environments/' + ENVIRONMENT + '/variables')['variables']}
        new_fp, host_fp = variables['HUB_DEPLOY_KEY_FINGERPRINT_V2'], variables['HUB_DEPLOY_HOST_FINGERPRINT_V2']
        assert new_fp not in (LEGACY, PROTECTED) and re.fullmatch(r'SHA256:[A-Za-z0-9+/]{43}', new_fp)
        assert self.api('/environments/' + ENVIRONMENT + '/secrets/' + SECRET)
        run = self.api('/actions/runs/' + str(run_id))
        head = self.api('/git/ref/heads/main')['object']['sha']
        assert run['name'] == 'Verify Hub VPS deployment access' and run['event'] == 'workflow_dispatch'
        assert run['status'] == 'completed' and run['conclusion'] == 'success' and run['head_sha'] == head
        assert run['head_branch'] == 'main' and '/hub-vps-ssh-probe.yml' in run['path']
        artifacts = self.api('/actions/runs/' + str(run_id) + '/artifacts')['artifacts']
        artifact = next(a for a in artifacts if a['name'] == 'hub-vps-ssh-probe' and not a['expired'])
        data = self.api('/actions/artifacts/' + str(artifact['id']) + '/zip', binary=True)
        assert len(data) < 1024 * 1024
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            assert archive.namelist() == ['hub-vps-ssh-probe.json']
            assert archive.getinfo('hub-vps-ssh-probe.json').file_size < 16384
            proof = json.loads(archive.read('hub-vps-ssh-probe.json'))
        assert proof == {'environment': ENVIRONMENT, 'commit': head, 'runId': str(run_id),
                         'keyFingerprint': new_fp, 'hostFingerprint': host_fp, 'sshAndScpSucceeded': True}
        server = self.server()
        assert new_fp in server['fingerprints'] and PROTECTED in server['fingerprints'] and not server['alternateKeys']
        assert host_fp in [row['fingerprint'] for row in server['hostKeys']]
        auth = self.authorization_proof(new_fp, run['created_at'])
        assert auth['newKeyAuthenticatedSinceProbe'] and auth['activeLegacySessions'] == 0
        legacy = self.api('/actions/secrets/SERVER_SSH_KEY')
        assert legacy['updated_at'] == '2025-10-08T19:32:40Z', 'Legacy secret changed since audit; re-audit before replacing'
        # Non-empty invalid value blocks organization fallback, while removing
        # the old public key invalidates any snapshotted private credential.
        self.put_secret('SERVER_SSH_KEY', 'RETIRED_USE_HUB_VPS_PRODUCTION_V2_ENVIRONMENT', environment=False)
        result = self.edit_server('retire', new_fp)
        self.assert_personal_access()
        after = self.authorization_proof(new_fp, run['created_at'])
        assert not result['legacyPresent'] and result['replacementPresent'] and after['activeLegacySessions'] == 0
        return {'legacyKeyFenced': True, 'legacyRepositorySecretMadeInert': True, 'newFingerprint': new_fp,
                'environment': ENVIRONMENT, 'probeRun': run_id, 'personalAndDeskKeyPreserved': True,
                'oldQueuedRunMayRemainVisible': True, 'applicationsRestarted': False}

    def audit(self):
        self.assert_personal_access()
        state = self.server()
        secret = self.api('/actions/secrets/SERVER_SSH_KEY')
        env = self.api('/environments/' + ENVIRONMENT, optional=True)
        result = {'legacyHubFingerprint': LEGACY, 'personalAndDeskFingerprint': PROTECTED,
                'legacyKeyPresent': LEGACY in state['fingerprints'], 'personalKeyPresent': PROTECTED in state['fingerprints'],
                'legacySecretUpdatedAt': secret['updated_at'], 'replacementEnvironmentExists': env is not None,
                'trustedHostFingerprints': [{'type': row['type'], 'fingerprint': row['fingerprint']} for row in state['hostKeys']],
                'changesMade': False}
        if env:
            variables = {v['name']: v['value'] for v in self.api('/environments/' + ENVIRONMENT + '/variables')['variables']}
            result['replacementFingerprint'] = variables.get('HUB_DEPLOY_KEY_FINGERPRINT_V2')
            result['replacementKeyPresent'] = result['replacementFingerprint'] in state['fingerprints']
            result['replacementSecretStored'] = bool(self.api('/environments/' + ENVIRONMENT + '/secrets/' + SECRET, optional=True))
        return result

    def probe(self):
        self.guard()
        assert self.api('/environments/' + ENVIRONMENT + '/secrets/' + SECRET)
        head = self.api('/git/ref/heads/main')['object']['sha']
        self.api('/actions/workflows/hub-vps-ssh-probe.yml/dispatches', 'POST', {'ref': 'main'})
        return {'probeRequested': True, 'reviewedMain': head, 'applicationsRestarted': False}

    def set_host_pin(self, value):
        self.guard()
        assert value in [row['fingerprint'] for row in self.server()['hostKeys']], 'Host pin must match the trusted server'
        self.variable('HUB_DEPLOY_HOST_FINGERPRINT_V2', value)
        return {'hostFingerprintUpdated': True, 'fingerprint': value, 'applicationsRestarted': False}


def main():
    if sys.flags.optimize:
        raise RuntimeError('Optimized Python is not supported for credential operations')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['audit', 'stage', 'probe', 'set-host-pin', 'retire'], nargs='?', default='audit')
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--probe-run', type=int)
    parser.add_argument('--fingerprint')
    args = parser.parse_args()
    if args.action != 'audit':
        assert args.execute, 'Mutation requires --execute after PR review/merge'
    operator = Operator()
    if args.action == 'audit':
        result = operator.audit()
    elif args.action == 'stage':
        result = operator.stage()
    elif args.action == 'probe':
        result = operator.probe()
    elif args.action == 'set-host-pin':
        assert args.fingerprint
        result = operator.set_host_pin(args.fingerprint)
    else:
        assert args.probe_run
        result = operator.retire(args.probe_run)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Provider exceptions and key parser messages must not reveal secrets.
        print(json.dumps({'success': False, 'errorType': type(error).__name__}), file=sys.stderr)
        sys.exit(1)
