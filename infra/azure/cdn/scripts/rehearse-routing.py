"""Stream to VPS Python with base64 Caddyfile argument; read-only media probes.

Creates only a labelled, loopback-bound throwaway proxy. Never reloads production
Caddy, changes writer state, edits production environment or prints filenames.
"""
import base64
import json
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request

NAME = 'cdn-public-routing-rehearsal'
LABEL = 'hub-cdn-routing-prep-v1'
ROOT = Path('/home/gen7fuel/cdn-routing-prep-20261117')
AZURE = 'https://gen7erp-cdn-prod-29b24248.azurewebsites.net'


def run(args, input=None):
    result = subprocess.run(args, input=input, text=True, capture_output=True, timeout=60)
    if result.returncode:
        raise RuntimeError('Rehearsal command failed: ' + args[0])
    return result.stdout


def inspect(name):
    return json.loads(run(['docker', 'inspect', name]))[0]


def request(base, path, headers=None, method='GET'):
    req = urllib.request.Request(base + path, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.status, response.headers, response.read()


def main():
    template = base64.b64decode(sys.argv[1], validate=True).decode()
    assert '{$CDN_PUBLIC_UPSTREAM:cdn:5001}' in template
    protected = ['cdn', 'webserver', 'backend', 'desk-cdn-backup']
    before = {name: inspect(name) for name in protected}
    web = before['webserver']
    network = sorted(set(web['NetworkSettings']['Networks']) & set(before['cdn']['NetworkSettings']['Networks']))[0]
    # A preexisting container is never adopted, removed or overwritten.
    result = subprocess.run(['docker', 'inspect', NAME], capture_output=True)
    assert result.returncode != 0, 'Rehearsal container already exists'
    ROOT.mkdir(exist_ok=True)
    config = ROOT / 'candidate.Caddyfile'
    config.write_text(template)
    report = {'checks': [], 'productionUnchanged': False, 'mediaWrites': 0}
    token = dict(item.split('=', 1) for item in before['cdn']['Config']['Env'] if '=' in item)['CDN_ADMIN_TOKEN']
    # Select one tiny range in memory; never record media names or inventory.
    _, _, body = request(AZURE, '/cdn/files?page=1', {'Authorization': 'Bearer ' + token})
    files = json.loads(body)['files']
    from urllib.parse import quote
    filename = next(item['filename'] for item in files if item['size'] > 0)
    media_path = '/cdn/download/' + quote(filename, safe='')
    expected = request(AZURE, media_path, {'Range': 'bytes=0-31'})
    assert expected[0] == 206
    for target, upstream in [('legacy', 'cdn:5001'), ('azure', AZURE), ('standby', 'cdn-rollback-vps:5001')]:
        created = False
        try:
            run(['docker', 'run', '-d', '--name', NAME, '--label', 'com.gen7.routing=' + LABEL,
                 '--network', network, '--memory', '128m', '--cpus', '0.25',
                 '-p', '127.0.0.1:15003:3000', '-e', 'CDN_PUBLIC_UPSTREAM=' + upstream,
                 '-v', str(config) + ':/etc/caddy/Caddyfile:ro', web['Image']])
            created = True
            run(['docker', 'exec', NAME, 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
            last_error = None
            for _ in range(30):
                try:
                    ranged = request('http://127.0.0.1:15003', media_path, {'Range': 'bytes=0-31'})
                    assert ranged[0] == 206 and ranged[2] == expected[2]
                    assert ranged[1]['Content-Range'] == expected[1]['Content-Range']
                    assert ranged[1]['Content-Type'] == expected[1]['Content-Type']
                    last_error = None
                    break
                except (OSError, AssertionError) as error:
                    last_error = error
                    time.sleep(0.5)
            if last_error:
                raise RuntimeError('Range proxy probe failed')
            if target != 'legacy':
                _, _, body = request('http://127.0.0.1:15003', '/cdn/health')
                health = json.loads(body)
                assert health['paused'] and health['drained']
            report['checks'].append({'target': target, 'validCaddyConfig': True,
                                     'pathRangeAndMimePreserved': True, 'readBytes': len(ranged[2])})
        finally:
            if created:
                assert inspect(NAME)['Config']['Labels']['com.gen7.routing'] == LABEL
                run(['docker', 'rm', '-f', NAME])
    for name, original in before.items():
        current = inspect(name)
        assert current['Id'] == original['Id'] and current['State']['StartedAt'] == original['State']['StartedAt']
    report['productionUnchanged'] = True
    report['success'] = True
    report['temporaryProxyRemoved'] = True
    (ROOT / 'summary.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Provider exceptions and paths can contain media identifiers.
        print(json.dumps({'success': False, 'errorType': type(error).__name__}), file=sys.stderr)
        sys.exit(1)
