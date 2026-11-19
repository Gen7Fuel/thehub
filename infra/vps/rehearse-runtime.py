"""Build first: docker build -t hub-runtime-rehearsal:local backend.
Run with Python. Creates only a disposable local project, no host ports,
production credentials or external network. Removes its own resources on exit.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[2]
PROJECT = 'hub-runtime-test-' + uuid.uuid4().hex[:10]


def run(args, **kwargs):
    return subprocess.run(args, cwd=ROOT, text=True, check=True, **kwargs)


def main():
    fixtures = {name: 'fixture' for name in re.findall(r'\$\{([A-Z_]+)', (ROOT / 'compose.yaml').read_text())}
    fixtures.update(BACKEND_IMAGE='hub-runtime-rehearsal:local', AUTH_BACKEND_IMAGE='fixture:unused', CDN_IMAGE='fixture:unused',
                    MONGO_URI='mongodb://mongo:27017/runtime_fixture', REDIS_URL='redis://redis:6379',
                    NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid', EMAIL_SERVICE_URL='http://email:5002',
                    CDN_SERVICE_URL='http://email:5002', SQL_SERVER='fixture.invalid', GVM_SYNC_ENABLED='false',
                    LOG_ARCHIVE_DOCUMENT_THRESHOLD='50000', LOG_ARCHIVE_SAFE_DAYS='2', LOG_ARCHIVE_TIER='Cold',
                    AZURE_STORAGE_CONNECTION_STRING='DefaultEndpointsProtocol=https;AccountName=fixture;AccountKey=Zml4dHVyZQ==;EndpointSuffix=core.windows.net')
    rendered = json.loads(run(['docker', 'compose', '-f', 'compose.yaml', 'config', '--format', 'json'],
                             env={**os.environ, **fixtures}, capture_output=True).stdout)
    services = {}
    for name in ['mongo', 'redis', 'postgres', 'backend', 'worker', 'scheduler']:
        value = rendered['services'][name]
        for key in ['container_name', 'networks', 'ports', 'volumes', 'restart']:
            value.pop(key, None)
        if name in ['backend', 'worker', 'scheduler']:
            value['environment']['HUB_RUNTIME_TEST'] = 'isolated-fixture'
            value['environment']['HOST'] = 'REHEARSAL'
        services[name] = value
    services['email'] = {'image': fixtures['BACKEND_IMAGE'], 'command': ['node', '/fixture/default.js'],
                         'volumes': [str(ROOT / 'postman/mocks/hub-email') + ':/fixture:ro']}
    config = {'services': services, 'networks': {'default': {'internal': True}}}
    with tempfile.TemporaryDirectory(prefix=PROJECT) as temp:
        file = Path(temp) / 'compose.json'
        file.write_text(json.dumps(config))
        cli = ['docker', 'compose', '-p', PROJECT, '-f', str(file)]
        try:
            run(cli + ['up', '-d', '--wait', '--wait-timeout', '180', 'mongo', 'redis', 'postgres', 'email', 'backend'])
            run(cli + ['exec', '-T', 'backend', 'node', 'scripts/rehearse-runtime.cjs', 'produce'])
            run(cli + ['up', '-d', '--wait', '--wait-timeout', '180', 'worker', 'scheduler'])
            for service, role in [('worker', 'worker'), ('scheduler', 'scheduler')]:
                state = json.loads(run(cli + ['exec', '-T', service, 'curl', '-fsS', 'http://localhost:5000/health'], capture_output=True).stdout)
                assert state['role'] == role and state['ready']
                assert len(state['workers']) == (16 if role == 'worker' else 0)
                assert len(state['schedules']) == (19 if role == 'scheduler' else 0)
            run(cli + ['exec', '-T', 'backend', 'node', 'scripts/rehearse-runtime.cjs', 'verify'])
            run(cli + ['stop', '--timeout', '30', 'backend', 'worker', 'scheduler'])
            for service in ['backend', 'worker', 'scheduler']:
                result = run(cli + ['ps', '-a', '--format', 'json', service], capture_output=True).stdout
                assert json.loads(result)['ExitCode'] == 0, service + ' did not shut down cleanly'
            print('PASS: three real Docker roles, 16 consumers, 19 schedules, clean SIGTERM shutdown')
        except Exception:
            run(cli + ['logs', '--tail', '45', 'backend', 'worker', 'scheduler'])
            raise
        finally:
            run(cli + ['down', '--volumes', '--remove-orphans'])


if __name__ == '__main__':
    main()
