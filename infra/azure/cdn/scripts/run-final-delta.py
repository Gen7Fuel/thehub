"""VPS wrapper; pass base64 JSON source-code bundle on argv, plan by default.

Execution requires explicit digest/count, a server freeze marker, an exclusive
deployment lock and stopped Hub producers. Nothing activates a writer.
"""
import argparse
import base64
import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys


def inspect(name):
    return json.loads(subprocess.run(['docker', 'inspect', name], text=True, capture_output=True, check=True, timeout=20).stdout)[0]


def environment(item):
    return dict(value.split('=', 1) for value in item['Config']['Env'] if '=' in value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle')
    parser.add_argument('--execute-production', action='store_true')
    parser.add_argument('--approved-digest')
    parser.add_argument('--approved-delete-count', type=int)
    args = parser.parse_args()
    bundle = json.loads(base64.b64decode(args.bundle, validate=True))
    backend, cdn, web = [inspect(name) for name in ['backend', 'cdn', 'webserver']]
    identity, source = environment(backend), environment(cdn)
    assert identity['AZURE_CLIENT_ID'] == '8dec8f37-a249-4fd6-98e6-9643c7f87f5a'
    lock = None
    if args.execute_production:
        assert not Path('/home/gen7fuel/.hub-cdn-new-account-activated').exists(), 'Old-source copy is forbidden after new-account activation'
        assert Path('/home/gen7fuel/.hub-cdn-deploy-freeze').exists(), 'Freeze marker required'
        assert not backend['State']['Running'], 'Stop Hub producers before final delta'
        assert args.approved_digest and args.approved_delete_count is not None
        lock = open('/home/gen7fuel/.hub-deploy.lock', 'a')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    values = {'CDN_COPY_SOURCE_CONNECTION_STRING': source['AZURE_STORAGE_CONNECTION_STRING'],
              'CDN_COPY_TENANT_ID': identity['AZURE_TENANT_ID'], 'CDN_COPY_CLIENT_ID': identity['AZURE_CLIENT_ID'],
              'CDN_COPY_CLIENT_SECRET': identity['AZURE_CLIENT_SECRET'], 'CDN_COPY_ADMIN_TOKEN': source['CDN_ADMIN_TOKEN'],
              'CDN_COPY_HOST_FREEZE_VERIFIED': 'true' if args.execute_production else 'false'}
    options = {'mode': 'execute' if args.execute_production else 'plan',
               'approvedDigest': args.approved_digest, 'approvedDeleteCount': args.approved_delete_count}
    code = r"""
process.on('uncaughtException', fail);
function fail(error) { console.error(JSON.stringify({success:false,errorType:error.name,code:error.code||null,statusCode:error.statusCode||null}));process.exit(1); }
const Module=require('node:module');
const bundle=BUNDLE;
function load(code,name,dependencies={}) {
 const m=new Module('/app/'+name,module);m.filename='/app/'+name;m.paths=Module._nodeModulePaths('/app');
 const actual=m.require.bind(m);m.require=name=>dependencies[name]||actual(name);m._compile(code,m.filename);return m.exports;
}
const storage=load(bundle.storage,'storage.probe.js');
const copy=load(bundle.copy,'scripts/copy-media.probe.cjs',{'../storage':storage});
const delta=load(bundle.delta,'scripts/final-delta.probe.cjs',{'../../../../cdn/scripts/copy-media.cjs':copy});
const runner=load(bundle.runner,'scripts/final-delta-runner.probe.cjs');
runner.runFinalDelta({...OPTIONS,...delta}).then(result=>console.log(JSON.stringify(result,null,2))).catch(fail);
""".replace('BUNDLE', json.dumps(bundle)).replace('OPTIONS', json.dumps(options))
    name = 'hub-cdn-final-delta-tool'
    assert subprocess.run(['docker', 'inspect', name], capture_output=True).returncode != 0
    network = sorted(set(cdn['NetworkSettings']['Networks']) & set(web['NetworkSettings']['Networks']))[0]
    command = ['docker', 'run', '--rm', '-i', '--name', name, '--label', 'com.gen7.cutover=final-delta-tool',
               '--network', network, '--memory', '1g', '--cpus', '1']
    for key in values:
        command += ['-e', key]
    command += [backend['Config']['Image'], 'node']
    result = subprocess.run(command, input=code, capture_output=True, text=True, env={**os.environ, **values}, timeout=10800)
    if result.returncode:
        try:
            failure = json.loads(result.stderr.strip().splitlines()[-1])
            print(json.dumps({key: failure.get(key) for key in ['success', 'errorType', 'code', 'statusCode']}))
        except Exception:
            print(json.dumps({'success': False, 'errorType': 'FinalDeltaToolFailed'}))
        raise SystemExit(1)
    print(json.dumps(json.loads(result.stdout), indent=2))
    if lock:
        lock.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'success': False, 'errorType': type(error).__name__}), file=sys.stderr)
        sys.exit(1)
