"""Offline vendor-agent readiness only; never claims an Azure Relay connection.

No credentials, host ports, production network or services. Disposable fixture
resources are removed even if the vendor service fails its readiness checks.
"""
import json
from pathlib import Path
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[3]


def run(args, **kwargs):
    return subprocess.run(args, cwd=ROOT, text=True, check=True, **kwargs)


def main():
    project = 'auth-relay-test-' + uuid.uuid4().hex[:10]
    agent = {'image': 'hub-auth-hcm:1.3.0', 'user': '10001:10001', 'read_only': True,
             'mem_limit': '384m', 'cpus': 0.5, 'pids_limit': 128,
             'cap_drop': ['ALL'], 'security_opt': ['no-new-privileges:true'],
             'tmpfs': ['/tmp:rw,noexec,nosuid,size=64m'],
             'volumes': ['config:/usr/share/HybridConnectionManager', 'home:/data']}
    config = {'services': {'agent': agent, 'mongo': {'image': 'mongo:8'}},
              'volumes': {'config': {}, 'home': {}}, 'networks': {'default': {'internal': True}}}
    with tempfile.TemporaryDirectory(prefix=project) as directory:
        file = Path(directory) / 'compose.json'; file.write_text(json.dumps(config))
        cli = ['docker', 'compose', '-p', project, '-f', str(file)]
        try:
            run(cli + ['up', '-d', '--wait', '--wait-timeout', '90'])
            result = run(cli + ['exec', '-T', 'agent', '/opt/hcm/CLI/hcm', 'list'], capture_output=True)
            assert result.returncode == 0
            print('PASS: vendor HCM service and local CLI start as non-root on a read-only container')
            # Same private TCP-only boundary the production agent will use.
            run(cli + ['exec', '-T', 'agent', 'bash', '-c', 'exec 3<>/dev/tcp/mongo/27017'])
            container = run(cli + ['ps', '-q', 'agent'], capture_output=True).stdout.strip()
            item = json.loads(run(['docker', 'inspect', container], capture_output=True).stdout)[0]
            assert item['HostConfig']['PortBindings'] in [None, {}]
            assert item['Config']['User'] == '10001:10001'
            assert item['HostConfig']['ReadonlyRootfs']
            assert 'ALL' in item['HostConfig']['CapDrop']
            assert item['HostConfig']['Memory'] == 384 * 1024 * 1024
            assert item['HostConfig']['NanoCpus'] == 500000000
            # Admin HTTP/2 socket must remain loopback-only, not reachable from peers.
            run(cli + ['exec', '-T', 'mongo', 'bash', '-c',
                'if timeout 2 bash -c "exec 3<>/dev/tcp/agent/5001"; then exit 1; else exit 0; fi'], capture_output=True)
            run(cli + ['restart', 'agent'])
            run(cli + ['up', '-d', '--wait', '--wait-timeout', '60', 'agent'])
            run(cli + ['stop', '--timeout', '45', 'agent'])
            state = json.loads(run(cli + ['ps', '-a', '--format', 'json', 'agent'], capture_output=True).stdout)
            assert state['ExitCode'] == 0
            print('PASS: private Mongo TCP reachability, no published ports, loopback management, restart, clean SIGINT stop')
            print('LIMIT: no Relay credentials or Azure resources used; end-to-end connectivity remains unverified')
        except Exception:
            run(cli + ['logs', '--tail', '45', 'agent'])
            raise
        finally:
            run(cli + ['down', '--volumes', '--remove-orphans'])


if __name__ == '__main__':
    main()
