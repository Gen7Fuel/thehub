"""Run on the VPS via stdin. Credentials remain in process/container environments.
Only loopback rehearsal ports and new, labelled standby resources are modified.
"""
import base64, hashlib, json, os, pathlib, re, subprocess, sys, time, urllib.request, uuid

ROOT = pathlib.Path('/home/gen7fuel/cdn-vps-rollback-20261116')
STANDBY = 'cdn-rollback-vps'
PROXY = 'cdn-rollback-proxy'
OWNER = 'gen7-cdn-rollback-v1'
AZURE = 'https://gen7erp-cdn-prod-29b24248.azurewebsites.net'
LOCAL = 'http://127.0.0.1:15001'
EDGE = 'http://127.0.0.1:15002'

def command(args, env=None, timeout=90):
    result = subprocess.run(args, env=env, capture_output=True, text=True, timeout=timeout)
    if result.returncode: raise RuntimeError('Command failed: ' + args[0])
    return result.stdout

def inspect(name):
    return json.loads(command(['docker', 'inspect', name]))[0]

def environment(container):
    return dict(item.split('=', 1) for item in container['Config']['Env'] if '=' in item)

def owned(name):
    result = subprocess.run(['docker', 'inspect', name], capture_output=True, text=True)
    if result.returncode: return None
    item = json.loads(result.stdout)[0]
    assert item['Config'].get('Labels', {}).get('com.gen7.rollback') == OWNER, 'Unmanaged container conflict'
    return item

def http(base, endpoint, token=None, data=None, method=None, content_type='application/json', timeout=25):
    headers = {}
    if token: headers['Authorization'] = 'Bearer ' + token
    if data is not None:
        headers['Content-Type'] = content_type
        if isinstance(data, dict): data = json.dumps(data).encode()
    request = urllib.request.Request(base + endpoint, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, response.read(), dict(response.headers)

def get_json(base, endpoint, token=None):
    return json.loads(http(base, endpoint, token)[1])

def pause(base, token, paused):
    result = json.loads(http(base, '/cdn/maintenance', token, {'paused': paused})[1])
    assert result['paused'] == paused
    if paused: assert result['drained'] and result['activeWrites'] == 0
    return result

def ready(base, release=None):
    deadline = time.monotonic() + 120
    while True:
        try:
            result = json.loads(http(base, '/cdn/health', timeout=3)[1])
            assert result['status'] == 'ok' and result['storage'] == 'azure'
            if release: assert result['release'] == release
            return result
        except Exception:
            if time.monotonic() >= deadline: raise
            time.sleep(2)

def configs():
    ROOT.mkdir(mode=0o750, parents=True, exist_ok=True)
    for target, upstream in [('azure', AZURE), ('vps', STANDBY + ':5001')]:
        extra = '\n            header_up Host gen7erp-cdn-prod-29b24248.azurewebsites.net' if target == 'azure' else ''
        value = '{\n    auto_https off\n}\n:8080 {\n    handle /cdn/* {\n        reverse_proxy ' + upstream + ' {' + extra + '\n        }\n    }\n    respond 404\n}\n'
        (ROOT / (target + '.Caddyfile')).write_text(value)

def switch(target):
    assert target in ['azure', 'vps']
    command(['docker', 'exec', PROXY, 'caddy', 'validate', '--config', '/etc/caddy/' + target + '.Caddyfile', '--adapter', 'caddyfile'])
    (ROOT / 'active.tmp').write_text((ROOT / (target + '.Caddyfile')).read_text())
    os.replace(ROOT / 'active.tmp', ROOT / 'active.Caddyfile')
    command(['docker', 'exec', PROXY, 'caddy', 'reload', '--config', '/etc/caddy/active.Caddyfile', '--adapter', 'caddyfile'])

def install(release):
    assert re.fullmatch('[a-f0-9]{40}', release)
    production = inspect('cdn'); backend = inspect('backend'); web = inspect('webserver')
    networks = set(production['NetworkSettings']['Networks']) & set(web['NetworkSettings']['Networks'])
    assert networks, 'No shared proxy network'
    network = sorted(networks)[0]
    image = 'ghcr.io/gen7fuel/thehub-cdn-rollback:' + release
    command(['docker', 'pull', image], timeout=180)
    configs()
    existing = owned(STANDBY)
    if existing: assert existing['Config']['Image'] == image, 'Existing standby has another release'
    else:
        old = environment(production); identity = environment(backend)
        values = {'CDN_STORAGE': 'azure', 'AZURE_STORAGE_ACCOUNT_URL': 'https://gen7erpmedia29b24248.blob.core.windows.net',
                  'AZURE_CONTAINER': 'hub', 'CDN_AZURE_AUTH_MODE': 'client-secret',
                  'CDN_AZURE_TENANT_ID': identity['AZURE_TENANT_ID'], 'CDN_AZURE_CLIENT_ID': identity['AZURE_CLIENT_ID'],
                  'CDN_AZURE_CLIENT_SECRET': identity['AZURE_CLIENT_SECRET'], 'CDN_ADMIN_TOKEN': old['CDN_ADMIN_TOKEN'],
                  'CDN_START_PAUSED': 'true', 'CDN_UPLOADS_DIR': '/home/cdn-control'}
        args = ['docker', 'run', '-d', '--name', STANDBY, '--label', 'com.gen7.rollback=' + OWNER,
                '--restart', 'unless-stopped', '--network', network, '--memory', '1g', '--cpus', '1',
                '-p', '127.0.0.1:15001:5001', '-v', 'cdn_rollback_control:/home/cdn-control']
        for name in values: args += ['-e', name]
        # Values are inherited by the Docker CLI; never passed in argv or saved to env files.
        command(args + [image], env={**os.environ, **values})
    health = ready(LOCAL, release); assert health['paused'] and health['drained']
    if not owned(PROXY):
        (ROOT / 'active.Caddyfile').write_text((ROOT / 'azure.Caddyfile').read_text())
        command(['docker', 'run', '-d', '--name', PROXY, '--label', 'com.gen7.rollback=' + OWNER,
                 '--restart', 'unless-stopped', '--network', network, '--memory', '128m', '--cpus', '0.25',
                 '-p', '127.0.0.1:15002:8080', '-v', str(ROOT) + ':/etc/caddy:ro',
                 web['Image'], 'caddy', 'run', '--config', '/etc/caddy/active.Caddyfile', '--adapter', 'caddyfile'])
    ready(EDGE)
    print(json.dumps({'installed': True, 'release': release, 'standbyPaused': True,
                      'loopbackPorts': [15001, 15002], 'productionContainerUnchanged': inspect('cdn')['Id'] == production['Id']}))

def rehearse(release):
    assert not (ROOT / 'rehearsal.json').exists(), 'Rehearsal already recorded'
    assert owned(STANDBY) and owned(PROXY)
    source = inspect('cdn'); token = environment(source)['CDN_ADMIN_TOKEN']
    azure_health = ready(AZURE); assert azure_health['paused'] and azure_health['drained']
    standby = ready(LOCAL, release); assert standby['paused'] and standby['drained']
    baseline = get_json(LOCAL, '/cdn/files', token)['totalFiles']
    created = []
    report = {'startedAt': time.time(), 'sourceRelease': release, 'baselineFiles': baseline, 'checks': []}
    try:
        switch('azure'); assert ready(EDGE)['release'] == azure_health['release']
        pause(LOCAL, token, False)
        contents = ('shared-storage-rollback-' + str(uuid.uuid4())).encode()
        name = json.loads(http(LOCAL, '/cdn/upload-base64', data={'base64Data': base64.b64encode(contents).decode(), 'fileName': 'probe.txt'})[1])['filename']
        assert re.fullmatch(r'[a-f0-9-]{36}\.txt', name); created.append(name)
        assert http(EDGE, '/cdn/download/' + name)[1] == contents
        pause(LOCAL, token, True)
        report['checks'].append('VPS write readable through Azure upstream in the same new storage')
        start = time.monotonic(); switch('vps'); assert ready(EDGE, release)['paused']
        pause(EDGE, token, False)
        assert http(EDGE, '/cdn/download/' + name)[1] == contents
        report['routingAndActivationSeconds'] = round(time.monotonic() - start, 3)
        boundary = 'test' + uuid.uuid4().hex
        svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>'
        body = ('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="probe.svg"\r\nContent-Type: image/svg+xml\r\n\r\n').encode()+svg+('\r\n--'+boundary+'--\r\n').encode()
        image = json.loads(http(EDGE, '/cdn/upload-png', data=body, content_type='multipart/form-data; boundary='+boundary)[1])['filename']
        assert re.fullmatch(r'[a-f0-9-]{36}\.png', image); created.append(image)
        payload = http(EDGE, '/cdn/download/'+image)[1]; assert payload.startswith(b'\x89PNG\r\n\x1a\n')
        assert http(AZURE, '/cdn/download/'+image)[1] == payload
        report['checks'].append('Fallback accepts uploads after route switch; Linux PNG conversion and Azure cross-read pass')
        pause(LOCAL, token, True)
        before = ready(LOCAL, release)['processStartedAt']
        command(['docker', 'restart', STANDBY])
        after = ready(LOCAL, release); assert after['paused'] and after['drained'] and after['processStartedAt'] != before
        report['checks'].append('Standby pause persists across an actual container restart')
    finally:
        try:
            if created:
                pause(LOCAL, token, False)
                for name in created: http(LOCAL, '/cdn/delete/'+name, token, method='DELETE')
            pause(LOCAL, token, True)
        finally: switch('azure')
    assert get_json(LOCAL, '/cdn/files', token)['totalFiles'] == baseline
    assert ready(AZURE)['paused'] and ready(LOCAL, release)['paused']
    assert inspect('cdn')['Id'] == source['Id'] and inspect('cdn')['State']['StartedAt'] == source['State']['StartedAt']
    report.update({'success': True, 'temporaryFilesRemoved': len(created), 'finalStandbyPaused': True,
                   'azurePaused': True, 'productionContainerUnchanged': True, 'finishedAt': time.time()})
    (ROOT / 'rehearsal.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))

try:
    action = sys.argv[1]; release = sys.argv[2] if len(sys.argv) > 2 else None
    if action == 'install': install(release)
    elif action == 'rehearse': rehearse(release)
    elif action == 'status': print((ROOT / 'rehearsal.json').read_text())
    else: raise ValueError('Choose install, rehearse, or status')
except Exception as error:
    print(json.dumps({'success': False, 'errorType': type(error).__name__}), file=sys.stderr)
    sys.exit(1)
