"""Isolated real-Caddy rehearsal; Python stdlib + Docker, no production calls.
Build hub-frontend-azure:local first. --fixture runs the disposable upstream.
"""
import base64
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid


class Fixture(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *_):
        pass

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        self.do_GET()

    def do_GET(self):
        if self.headers.get('Upgrade', '').lower() == 'websocket':
            accept = base64.b64encode(hashlib.sha1((self.headers['Sec-WebSocket-Key'] +
                '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
            self.send_response(101)
            for k, v in [('Upgrade', 'websocket'), ('Connection', 'Upgrade'), ('Sec-WebSocket-Accept', accept)]:
                self.send_header(k, v)
            self.end_headers()
            head = self.rfile.read(2)
            mask = self.rfile.read(4)
            data = self.rfile.read(head[1] & 127)
            payload = bytes(v ^ mask[i % 4] for i, v in enumerate(data))
            self.wfile.write(bytes([0x81, len(payload)]) + payload)
            self.wfile.flush()
            self.close_connection = True
            return
        body = self.rfile.read(int(self.headers.get('Content-Length', '0')))
        status, content_type, extra = 200, 'application/json', {}
        if self.path.startswith('/cdn/download/'):
            payload, content_type = b'0123456789abcdef', 'application/octet-stream'
            extra['Accept-Ranges'] = 'bytes'
            if self.headers.get('Range') == 'bytes=2-5':
                status, payload, extra['Content-Range'] = 206, payload[2:6], 'bytes 2-5/16'
        else:
            status = 503 if self.path.endswith('/error') else 404 if self.path.endswith('/missing') else 200
            payload = json.dumps({'port': self.server.server_port, 'path': self.path,
                'method': self.command, 'authorization': self.headers.get('Authorization'),
                'contentType': self.headers.get('Content-Type'), 'origin': self.headers.get('Origin'),
                'bodySha256': hashlib.sha256(body).hexdigest()}).encode()
        self.send_response(status)
        for k, v in {'Content-Type': content_type, 'Content-Length': str(len(payload)), **extra}.items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(payload)


def docker(*args, check=True):
    result = subprocess.run(['docker', *args], text=True, capture_output=True, timeout=180)
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result.stdout.strip()


def websocket(port, path):
    with socket.create_connection(('127.0.0.1', port), timeout=5) as conn:
        key = base64.b64encode(uuid.uuid4().bytes).decode()
        conn.sendall((f'GET {path} HTTP/1.1\r\nHost: localhost:{port}\r\n'
            'Connection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\n'
            f'Sec-WebSocket-Key: {key}\r\nOrigin: https://app.gen7fuel.com\r\n\r\n').encode())
        response = b''
        while b'\r\n\r\n' not in response:
            data = conn.recv(1)
            assert data, 'WebSocket closed before upgrade'
            response += data
        assert b'101 Switching Protocols' in response, response
        expected = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest())
        assert expected in response
        payload, mask = b'hello', b'abcd'
        conn.sendall(bytes([0x81, 0x80 | len(payload)]) + mask + bytes(v ^ mask[i % 4] for i, v in enumerate(payload)))
        echoed = b''
        while len(echoed) < 7:
            data = conn.recv(7 - len(echoed))
            assert data, 'WebSocket closed before echo'
            echoed += data
        assert echoed == b'\x81\x05hello', echoed


def rehearse():
    suffix = uuid.uuid4().hex[:10]
    network, upstream, frontend = [f'frontend-{v}-{suffix}' for v in ('net', 'fixture', 'app')]
    created, network_created = [], False
    try:
        docker('image', 'inspect', 'hub-frontend-azure:local')
        docker('pull', 'python:3.12-alpine')
        # Dedicated bridge; published loopback ports also work on Docker Desktop.
        # Every configured upstream is this fixture; no production URLs exist here.
        docker('network', 'create', network)
        network_created = True
        docker('run', '-d', '--name', upstream, '--network', network, '--mount',
            f'type=bind,source={Path(__file__).resolve()},target=/fixture.py,readonly',
            'python:3.12-alpine', 'python', '/fixture.py', '--fixture')
        created.append(upstream)
        args = ['run', '-d', '--name', frontend, '--network', network, '-p', '127.0.0.1::8080']
        for key, port in [('API', 9000), ('AUTH', 9001), ('CDN', 9002), ('SIGNALING', 9003)]:
            args += ['-e', f'HUB_{key}_UPSTREAM=http://{upstream}:{port}']
        docker(*args, 'hub-frontend-azure:local')
        created.append(frontend)
        port = int(json.loads(docker('inspect', frontend))[0]['NetworkSettings']['Ports']['8080/tcp'][0]['HostPort'])

        def request(path, data=None, headers=None, method=None):
            req = urllib.request.Request(f'http://127.0.0.1:{port}' + path, data=data, headers=headers or {}, method=method)
            try:
                response = urllib.request.urlopen(req, timeout=10)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                return response.status, response.headers, response.read()

        for _ in range(60):
            try:
                if request('/frontend-health')[0] == 200 and request('/api/probe')[0] == 200:
                    break
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(0.5)
        else:
            raise RuntimeError('Container did not become ready')
        index = request('/')[2]
        assert b'<html' in index
        for path in ['/', '/index.html', '/cash-summary/form', '/version.json', '/sw.js']:
            status, headers, body = request(path)
            assert status == 200 and 'no-store' in headers.get('Cache-Control', ''), (path, status)
            if path == '/cash-summary/form':
                assert body == index
        assert json.loads(request('/version.json')[2])['commit']
        assert request('/assets/does-not-exist.js')[0] == 404
        print('PASS: SPA deep links, missing chunks, release metadata and update caching', flush=True)
        for prefix, expected in [('/api', 9000), ('/login-auth', 9001), ('/cdn', 9002), ('/socket.io', 9000), ('/signaling', 9003)]:
            for path in [prefix, prefix + '/probe?query=preserved']:
                status, _, body = request(path, headers={'Authorization': 'Bearer synthetic-token', 'Origin': 'https://app.gen7fuel.com'})
                result = json.loads(body)
                assert status == 200 and result['port'] == expected and result['path'] == path
                assert result['authorization'] == 'Bearer synthetic-token' and result['origin'] == 'https://app.gen7fuel.com'
            assert request(prefix + '/missing')[0] == 404
            assert request(prefix + '/error')[0] == 503
        print('PASS: five route groups, query, bearer, origin, and upstream errors', flush=True)
        for content_type, body in [
            ('multipart/form-data; boundary=frontend', b'--frontend\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\n\r\nfile bytes\r\n--frontend--\r\n'),
            ('application/json', b'{"base64Data":"dGVzdA==","fileName":"test.txt"}'),
        ]:
            path = '/cdn/upload' if content_type.startswith('multipart') else '/cdn/upload-base64'
            status, _, payload = request(path, data=body, headers={'Content-Type': content_type})
            result = json.loads(payload)
            assert status == 200 and result['method'] == 'POST'
            assert result['contentType'] == content_type and result['bodySha256'] == hashlib.sha256(body).hexdigest()
        status, headers, body = request('/cdn/download/test.bin', headers={'Range': 'bytes=2-5', 'Accept-Encoding': 'gzip'})
        assert status == 206 and body == b'2345' and headers['Content-Range'] == 'bytes 2-5/16'
        assert 'Content-Encoding' not in headers
        status, headers, body = request('/cdn/download/test.bin', method='HEAD')
        assert status == 200 and not body and headers['Content-Length'] == '16'
        print('PASS: multipart/base64 uploads, HEAD, and uncompressed byte ranges', flush=True)
        websocket(port, '/socket.io/?EIO=4&transport=websocket')
        websocket(port, '/signaling/room')
        print('PASS: Socket.IO and signaling WebSocket upgrade and bidirectional frames', flush=True)
    except Exception:
        if frontend in created:
            print(docker('logs', '--tail', '30', frontend, check=False), file=sys.stderr)
        raise
    finally:
        for name in reversed(created):
            docker('rm', '-f', name, check=False)
        if network_created:
            docker('network', 'rm', network, check=False)


if __name__ == '__main__':
    if '--fixture' in sys.argv:
        servers = [ThreadingHTTPServer(('0.0.0.0', port), Fixture) for port in range(9000, 9004)]
        for server in servers:
            threading.Thread(target=server.serve_forever, daemon=True).start()
        threading.Event().wait()
    else:
        rehearse()
