"""Disposable local auth + MongoDB rehearsal. No production credentials or routes."""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[3]


def run(args, **kwargs):
    return subprocess.run(args, cwd=ROOT, check=True, text=True, **kwargs)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--vps', action='store_true', help='Exercise the current Docker image and shared model mounts')
    args = parser.parse_args()
    project = 'hub-auth-test-' + uuid.uuid4().hex[:10]
    environment = {'MONGO_URI': 'mongodb://mongo:27017/auth_fixture', 'JWT_SECRET': 'isolated-fixture-secret', 'PORT': '8080'}
    config = {'services': {
        'mongo': {'image': 'mongo:8'},
        'auth': {'image': 'hub-auth-vps-rehearsal:local' if args.vps else 'hub-auth-rehearsal:local', 'environment': environment,
                 'volumes': [str(ROOT / 'infra/azure/auth/auth-smoke.cjs') + ':/fixture/auth-smoke.cjs:ro'],
                 'healthcheck': {'test': ['CMD', 'curl', '-fsS', 'http://localhost:8080/login-auth/health'], 'interval': '2s', 'timeout': '2s', 'retries': 30}},
    }, 'networks': {'default': {'internal': True}}}
    if args.vps:
        config['services']['auth']['volumes'] += [str(ROOT / 'backend/models') + ':/app/models:ro',
            str(ROOT / 'backend/utils/attachSiteAlias.js') + ':/app/utils/attachSiteAlias.js:ro']
    with tempfile.TemporaryDirectory(prefix=project) as directory:
        file = Path(directory) / 'compose.json'; file.write_text(json.dumps(config))
        cli = ['docker', 'compose', '-p', project, '-f', str(file)]
        try:
            run(cli + ['up', '-d', '--wait', '--wait-timeout', '90'])
            run(cli + ['exec', '-T', 'auth', 'node', '/fixture/auth-smoke.cjs'])
            run(cli + ['stop', '--timeout', '30', 'mongo'])
            for _ in range(45):
                status = run(cli + ['exec', '-T', 'auth', 'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:8080/login-auth/health'], capture_output=True).stdout
                if status == '503': break
                time.sleep(1)
            assert status == '503', 'Health did not reject database outage'
            run(cli + ['start', 'mongo'])
            for _ in range(45):
                status = run(cli + ['exec', '-T', 'auth', 'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:8080/login-auth/health'], capture_output=True).stdout
                if status == '200': break
                time.sleep(1)
            assert status == '200', 'Health did not recover after MongoDB restart'
            run(cli + ['stop', '--timeout', '45', 'auth'])
            state = json.loads(run(cli + ['ps', '-a', '--format', 'json', 'auth'], capture_output=True).stdout)
            assert state['ExitCode'] == 0
            print('PASS: custom hosted PORT, database outage/recovery readiness, and clean SIGTERM shutdown')
        except Exception:
            run(cli + ['logs', '--tail', '50', 'auth'])
            raise
        finally:
            run(cli + ['down', '--volumes', '--remove-orphans'])


if __name__ == '__main__':
    main()
