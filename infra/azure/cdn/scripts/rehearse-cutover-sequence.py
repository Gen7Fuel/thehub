"""Disposable real-CDN rehearsal using synthetic local storage, never Azure.

Runs on VPS over stdin. All new resources use an internal isolated network,
synthetic token and loopback ports. No production environment is copied.
"""
import base64
import json
import re
import subprocess
import time
import urllib.error
import urllib.request

OWNER = 'hub-cutover-sequence-v1'
PREFIX = 'hub-cutover-rehearsal-'
NETWORK = PREFIX + 'net'
VOLUME = PREFIX + 'media'
TOKEN = 'synthetic-rehearsal-token'
containers = []
network_created = False
volume_created = False


def run(args, input=None):
    result = subprocess.run(args, input=input, text=True, capture_output=True, timeout=90)
    if result.returncode:
        code = next((value for value in ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'] if value in result.stderr), '')
        raise RuntimeError('Rehearsal command failed: ' + ' '.join(args[:4]) + (':' + code if code else ''))
    return result.stdout.strip()


def inspect(name):
    return json.loads(run(['docker', 'inspect', name]))[0]


def request(base, path, data=None, method=None, content_type='application/json'):
    headers = {'Authorization': 'Bearer ' + TOKEN}
    if data is not None:
        headers['Content-Type'] = content_type
        if isinstance(data, dict):
            data = json.dumps(data).encode()
    # An internal Docker network does not rely on host-port forwarding. Run the
    # probe client inside the old fixture and address fixture DNS directly.
    suffix = {15004: 'old:5001', 15005: 'new:5001', 15006: 'standby:5001', 15007: 'proxy:8080'}[int(base.rsplit(':', 1)[1])]
    payload = {'url': 'http://' + PREFIX + suffix + path, 'headers': headers,
               'method': method or ('POST' if data is not None else 'GET'),
               'body': base64.b64encode(data).decode() if data is not None else None}
    code = "const p=" + json.dumps(payload) + "; fetch(p.url,{method:p.method,headers:p.headers,body:p.body===null?undefined:Buffer.from(p.body,'base64'),signal:AbortSignal.timeout(15000)}).then(async r=>console.log(JSON.stringify({status:r.status,body:Buffer.from(await r.arrayBuffer()).toString('base64')}))).catch(e=>{console.error(e.cause?.code||e.code||'FETCH_FAILED');process.exit(1)});"
    result = json.loads(run(['docker', 'exec', '-i', PREFIX + 'old', 'node'], code))
    return result['status'], base64.b64decode(result['body'])


def pause(base, value):
    status, body = request(base, '/cdn/maintenance', {'paused': value})
    state = json.loads(body)
    assert status == 200 and state['paused'] == value and state['activeWrites'] == 0
    if value:
        assert state['drained']


def upload(base, text):
    status, body = request(base, '/cdn/upload-base64', {
        'base64Data': base64.b64encode(text).decode(), 'fileName': 'synthetic.txt'})
    assert status == 200
    name = json.loads(body)['filename']
    assert re.fullmatch(r'[a-f0-9-]{36}\.txt', name)
    return name


def route(name):
    config = {'apps': {'http': {'servers': {'rehearsal': {'listen': [':8080'], 'routes': [
        {'match': [{'path': ['/cdn/*']}], 'handle': [{'handler': 'reverse_proxy', 'upstreams': [{'dial': name + ':5001'}]}]}
    ]}}}}}
    run(['docker', 'exec', '-i', PREFIX + 'proxy', 'sh', '-c', 'cat > /tmp/rehearsal.json'], json.dumps(config))
    run(['docker', 'exec', PREFIX + 'proxy', 'caddy', 'validate', '--config', '/tmp/rehearsal.json'])
    run(['docker', 'exec', PREFIX + 'proxy', 'caddy', 'reload', '--config', '/tmp/rehearsal.json'])


def main():
    global network_created, volume_created
    protected = {name: inspect(name) for name in ['cdn', 'backend', 'webserver', 'desk-api', 'desk-cdn-backup', 'cdn-rollback-vps']}
    image = protected['cdn-rollback-vps']['Image']
    for resource, name in [('network', NETWORK), ('volume', VOLUME)]:
        assert subprocess.run(['docker', resource, 'inspect', name], capture_output=True).returncode != 0
    for suffix in ['old', 'new', 'standby', 'proxy']:
        assert subprocess.run(['docker', 'inspect', PREFIX + suffix], capture_output=True).returncode != 0
    run(['docker', 'network', 'create', '--internal', '--label', 'com.gen7.cutover=' + OWNER, NETWORK]); network_created = True
    run(['docker', 'volume', 'create', '--label', 'com.gen7.cutover=' + OWNER, VOLUME]); volume_created = True
    bootstrap = "const fs=require('fs'); const s=require('./storage').createStorage(); fs.mkdirSync('/control',{recursive:true}); s.uploadsDir='/control'; require('./app').createApp({storage:s}).listen(5001,'0.0.0.0');"
    for suffix, port in [('old', 15004), ('new', 15005), ('standby', 15006)]:
        name = PREFIX + suffix
        args = ['docker', 'run', '-d', '--name', name, '--label', 'com.gen7.cutover=' + OWNER,
                '--network', NETWORK, '--memory', '256m', '--cpus', '0.5',
                '-p', f'127.0.0.1:{port}:5001', '-e', 'CDN_STORAGE=local', '-e', 'CDN_UPLOADS_DIR=/media',
                '-e', 'CDN_ADMIN_TOKEN=' + TOKEN, '-e', 'CDN_START_PAUSED=' + ('false' if suffix == 'old' else 'true')]
        if suffix != 'old':
            args += ['-v', VOLUME + ':/media']
        run(args + [image, 'node', '-e', bootstrap]); containers.append(name)
    run(['docker', 'run', '-d', '--name', PREFIX + 'proxy', '--label', 'com.gen7.cutover=' + OWNER,
         '--network', NETWORK, '--memory', '128m', '--cpus', '0.25', '-p', '127.0.0.1:15007:8080', protected['webserver']['Image']])
    containers.append(PREFIX + 'proxy')
    for name in containers:
        state = inspect(name)['State']
        if not state['Running']:
            raise RuntimeError('Fixture exited: ' + name + ':' + str(state['ExitCode']))
    old, new, standby, edge = [f'http://127.0.0.1:{port}' for port in [15004, 15005, 15006, 15007]]
    for base in [old, new, standby]:
        for attempt in range(30):
            try:
                assert request(base, '/cdn/maintenance')[0] == 200
                break
            except (OSError, RuntimeError):
                time.sleep(0.25)
        else:
            raise RuntimeError('Fixture did not start')
    route(PREFIX + 'old')
    content = b'synthetic-cutover-baseline'
    name = upload(edge, content)
    pause(old, True)
    assert request(edge, '/cdn/upload-base64', {'base64Data': 'eA==', 'fileName': 'blocked.txt'})[0] == 503
    # Synthetic stand-in for verified final Blob delta; no production data.
    run(['docker', 'exec', PREFIX + 'new', 'node', '-e',
         "require('fs').writeFileSync('/media/' + process.argv[1],Buffer.from(process.argv[2],'base64'))", name, base64.b64encode(content).decode()])
    route(PREFIX + 'new')
    assert request(edge, '/cdn/download/' + name)[1] == content
    assert request(edge, '/cdn/upload-base64', {'base64Data': 'eA==', 'fileName': 'blocked.txt'})[0] == 503
    pause(new, False)
    fresh = upload(edge, b'new-host-shared-storage-write')
    assert request(standby, '/cdn/download/' + fresh)[1] == b'new-host-shared-storage-write'
    boundary = 'synthetic-boundary'
    body = ('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="probe.svg"\r\nContent-Type: image/svg+xml\r\n\r\n<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>\r\n--'+boundary+'--\r\n').encode()
    status, response = request(edge, '/cdn/upload-png', body, content_type='multipart/form-data; boundary=' + boundary)
    assert status == 200
    png = json.loads(response)['filename']
    assert request(edge, '/cdn/download/' + png)[1].startswith(b'\x89PNG\r\n\x1a\n')
    pause(new, True)
    route(PREFIX + 'standby')
    pause(standby, False)
    assert request(edge, '/cdn/download/' + fresh)[1] == b'new-host-shared-storage-write'
    fallback_file = upload(edge, b'standby-write')
    assert request(new, '/cdn/download/' + fallback_file)[1] == b'standby-write'
    pause(standby, True)
    run(['docker', 'restart', PREFIX + 'standby'])
    for attempt in range(30):
        try:
            status, body = request(standby, '/cdn/maintenance')
            state = json.loads(body)
            assert status == 200 and state['paused'] and state['drained']
            break
        except (OSError, RuntimeError):
            time.sleep(0.25)
    else:
        raise RuntimeError('Restarted fixture did not become ready')
    for name, before in protected.items():
        after = inspect(name)
        assert after['Id'] == before['Id'] and after['State']['StartedAt'] == before['State']['StartedAt']
        assert after['Config']['Env'] == before['Config']['Env']
    return {'success': True, 'realCdnAndProxyImages': True, 'syntheticStorageOnly': True,
            'oldWriterFencedBeforeSwitch': True, 'newWriterNotEnabledUntilRoutingVerified': True,
            'base64AndPngUploadsPassed': True, 'sameStorageStandbyRollbackPassed': True,
            'pausePersistedAcrossFixtureRestart': True, 'productionContainersUnchanged': True,
            'productionMediaWrites': 0}


try:
    report = main()
except Exception as error:
    report = {'success': False, 'errorType': type(error).__name__}
    if isinstance(error, RuntimeError):
        report['operation'] = str(error)
finally:
    for name in reversed(containers):
        assert inspect(name)['Config']['Labels']['com.gen7.cutover'] == OWNER
        run(['docker', 'rm', '-f', name])
    if volume_created:
        value = json.loads(run(['docker', 'volume', 'inspect', VOLUME]))[0]
        assert value['Labels']['com.gen7.cutover'] == OWNER
        run(['docker', 'volume', 'rm', VOLUME])
    if network_created:
        value = json.loads(run(['docker', 'network', 'inspect', NETWORK]))[0]
        assert value['Labels']['com.gen7.cutover'] == OWNER
        run(['docker', 'network', 'rm', NETWORK])
    report['isolatedResourcesRemoved'] = True
print(json.dumps(report, indent=2))
raise SystemExit(0 if report['success'] else 1)
