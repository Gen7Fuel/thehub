# Hub and Desk Azure VM storage

Use a Linux Azure VM with a persistent data disk mounted at `/mnt/gen7-data`. Hub and Desk deploy as independent Compose projects. Each project points `GEN7_DATA_ROOT` at that mount and uses its own directories. The CDN stays on Azure App Service and Blob Storage.

## Configure a new host before starting Docker workloads

1. Attach the managed disk. Identify the disk and its filesystem UUID with `lsblk -f`. Only initialize a filesystem on a verified empty disk. Add the filesystem to `/etc/fstab` by UUID at `/mnt/gen7-data` and mount it. Verify the exact mount with `findmnt --mountpoint /mnt/gen7-data`.
2. Put the expected filesystem UUID in `/etc/gen7-data-disk.conf` as `GEN7_DATA_DISK_UUID=<filesystem UUID>`. Update this only after verifying a replacement disk during recovery.
3. Install the guard and drop-in before creating either Compose project. These commands are for the newly prepared VM. Restarting Docker on a host with active applications interrupts their containers.

   ```sh
   sudo install -D -m 0755 infra/vm/verify-data-mount.sh /usr/local/libexec/gen7-verify-data-mount
   sudo install -D -m 0644 infra/vm/docker-data-mount.conf /etc/systemd/system/docker.service.d/gen7-data-mount.conf
   sudo systemctl daemon-reload
   sudo systemctl restart docker.service
   ```

4. With the disk mounted, create `hub/mongo`, `hub/postgres`, `hub/redis`, `desk/mongo`, `desk/pos-data`, and `desk/pos-archive` below `/mnt/gen7-data`. Set owner and permissions for each container's runtime user. Desk's POS API runs as UID 1001 and requires write and traverse access to both POS directories. Verify database directory ownership against the pinned images before first startup.

The Docker unit requests the actual mount and checks its UUID before the daemon starts. This covers Docker-managed container restarts after a reboot. Compose also rejects missing bind sources. Keep Docker `live-restore` disabled and stop both projects and Docker before manually unmounting or detaching the disk.

## Deployment and recovery checks

- Start Hub from `compose.vm.yaml` and Desk from `compose.yaml` plus `compose.vm.yaml`. Preserve the two Compose project names for successive deployments. Install a host Caddy routing configuration separately. The app origins bind to loopback, and the public VPS Caddy remains the HTTPS entry during acceptance.
- Use the existing CDN from both projects. Enable the Desk `cdn-backup` profile only at its authorized handover point after fencing the previous worker. Configure and verify the shared email and office/POS integration paths before production activation.
- Store native backups and required file archives off the VM in Blob Storage. For a replacement host, mount the verified data disk or restore into fresh directories before starting application writers. Check MongoDB, PostgreSQL, Redis and POS data sentinels and signed-in routing before resuming both stacks. Measure recovery against the agreed downtime and data-loss limits.

## Record overnight host memory

From the repository root on the Linux VM, run the sampler in the background. This example samples every five seconds and stops after 24 hours. Keep the log on the OS filesystem so it is available independently of the data disk.

```sh
log="$HOME/gen7-memory-$(date -u +%Y%m%dT%H%M%SZ).csv"
nohup timeout 24h sh infra/vm/sample-host-memory.sh 5 </dev/null >"$log" 2>"$log.err" &
printf '%s\n' "$log"
```

The next day, use the printed path to find the minimum available memory and its UTC timestamp. Set `log` to that path if you opened a new shell.

```sh
awk -F, 'NR > 1 && (!seen || $3 < min) { seen=1; min=$3; at=$1 }
  END { if (seen) printf "%.1f MiB available at %s\n", min / 1024, at; else exit 1 }' "$log"
```

Compare the UTC timestamps with queue activity, scheduled jobs and backup logs. Swap page counts and pressure times are cumulative since boot, so compare adjacent rows to see activity. Blank pressure fields mean the kernel interface was unavailable. Check the kernel journal for out-of-memory events and the matching `.err` file for sampler errors.
