#!/usr/bin/env python
"""SSH helper — runs a command on the remote server and streams output."""
import sys, os, paramiko, time, io

HOST    = '178.104.42.42'
USER    = 'root'
KEY     = os.path.expanduser('~/.ssh/electrade_hetzner')

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def run(cmd, timeout=300, print_output=True):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, key_filename=KEY, timeout=30)
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=True)
    out = ''
    while True:
        if stdout.channel.exit_status_ready():
            break
        if stdout.channel.recv_ready():
            chunk = stdout.channel.recv(4096).decode('utf-8', errors='replace')
            out += chunk
            if print_output:
                print(chunk, end='', flush=True)
        time.sleep(0.05)
    remaining = stdout.read().decode('utf-8', errors='replace')
    out += remaining
    if print_output and remaining:
        print(remaining, end='', flush=True)
    rc = stdout.channel.recv_exit_status()
    client.close()
    return rc, out

if __name__ == '__main__':
    cmd = ' '.join(sys.argv[1:])
    rc, _ = run(cmd)
    sys.exit(rc)
