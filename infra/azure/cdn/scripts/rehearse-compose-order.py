"""Exercise actual Compose --no-deps/--wait commands on disposable real images."""
import json
import subprocess

PROJECT = 'hub-cutover-compose-rehearsal'


def run(args, body=None):
    result = subprocess.run(args, input=body, text=True, capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError('Isolated Compose command failed')
    return result.stdout


def inspect(name):
    return json.loads(run(['docker', 'inspect', name]))[0]


protected = {name: inspect(name) for name in ['backend', 'cdn', 'webserver', 'desk-api', 'desk-cdn-backup']}
assert not run(['docker', 'ps', '-aq', '--filter', 'label=com.docker.compose.project=' + PROJECT]).strip()
assert not run(['docker', 'network', 'ls', '-q', '--filter', 'label=com.docker.compose.project=' + PROJECT]).strip()
config = {'apps': {'http': {'servers': {'fixture': {'listen': [':8080'], 'routes': [
    {'handle': [{'handler': 'reverse_proxy', 'upstreams': [{'dial': 'backend:5001'}]}]}
]}}}}}
model = {'services': {
    'backend': {'image': inspect('cdn-rollback-vps')['Image'], 'environment': {
        'CDN_STORAGE': 'local', 'CDN_UPLOADS_DIR': '/tmp/synthetic-media', 'CDN_ADMIN_TOKEN': 'synthetic-compose-token', 'CDN_START_PAUSED': 'true'},
        'mem_limit': '256m', 'cpus': 0.5,
        'healthcheck': {'test': ['CMD', 'node', '-e', "fetch('http://127.0.0.1:5001/cdn/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],
                        'interval': '1s', 'timeout': '2s', 'retries': 20}},
    'caddy': {'image': protected['webserver']['Image'], 'mem_limit': '128m', 'cpus': 0.25,
              'command': ['sh', '-c', "printf '%s' '" + json.dumps(config) + "' > /tmp/fixture.json; exec caddy run --config /tmp/fixture.json"],
              'depends_on': {'backend': {'condition': 'service_healthy'}}, 'environment': {'REHEARSAL_TARGET': 'before'}}},
    'networks': {'default': {'internal': True}}}
base = ['docker', 'compose', '-p', PROJECT, '-f', '-']
try:
    run(base + ['up', '-d', '--wait', '--wait-timeout', '60'], json.dumps(model))
    run(base + ['stop', 'backend'], json.dumps(model))
    model['services']['caddy']['environment']['REHEARSAL_TARGET'] = 'after'
    run(base + ['up', '-d', '--no-deps', '--wait', '--wait-timeout', '60', 'caddy'], json.dumps(model))
    stopped = run(base + ['ps', '-aq', 'backend'], json.dumps(model)).strip()
    assert inspect(stopped)['State']['Running'] is False
    run(base + ['up', '-d', '--no-deps', '--wait', '--wait-timeout', '60', 'backend'], json.dumps(model))
    proxy = run(base + ['ps', '-q', 'caddy'], json.dumps(model)).strip()
    health = json.loads(run(['docker', 'exec', proxy, 'wget', '-qO-', 'http://127.0.0.1:8080/cdn/health']))
    assert health['paused'] and health['drained']
    for name, before in protected.items():
        after = inspect(name)
        assert after['Id'] == before['Id'] and after['State']['StartedAt'] == before['State']['StartedAt']
    report = {'success': True, 'actualComposeCommandsExercised': True,
              'caddyRecreatedWhileBackendStayedStopped': True, 'backendRestartWaitedForHealth': True,
              'proxyReadPassedAfterBackendRestart': True, 'productionContainersUnchanged': True}
except Exception as error:
    report = {'success': False, 'errorType': type(error).__name__}
finally:
    run(base + ['down', '--volumes', '--remove-orphans'], json.dumps(model))
    report['isolatedResourcesRemoved'] = True
print(json.dumps(report, indent=2))
raise SystemExit(0 if report['success'] else 1)
