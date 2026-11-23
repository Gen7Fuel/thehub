#!/bin/sh
# Write timestamped Linux host memory samples as CSV to stdout.
set -eu

interval=${1:-5}
case "$interval" in
    0*|*[!0-9]*) echo "Usage: $0 [positive interval in seconds]" >&2; exit 2 ;;
esac
if [ "$#" -gt 1 ] || [ ! -r /proc/meminfo ] || [ ! -r /proc/vmstat ]; then
    echo "Usage: $0 [positive interval in seconds] (requires Linux procfs)" >&2
    exit 2
fi

set -- /proc/meminfo /proc/vmstat
if [ -r /proc/pressure/memory ]; then
    set -- "$@" /proc/pressure/memory
fi

printf '%s\n' 'timestamp_utc,total_kib,available_kib,swap_used_kib,swap_in_pages_total,swap_out_pages_total,pressure_some_us_total,pressure_full_us_total'
while :; do
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    sample=$(awk '
        $1 == "MemTotal:" { total = $2 }
        $1 == "MemAvailable:" { available = $2 }
        $1 == "SwapTotal:" { swapTotal = $2 }
        $1 == "SwapFree:" { swapFree = $2 }
        $1 == "pswpin" { swapIn = $2 }
        $1 == "pswpout" { swapOut = $2 }
        $1 == "some" { pressureSome = substr($5, 7) }
        $1 == "full" { pressureFull = substr($5, 7) }
        END {
            if (total == "" || available == "" || swapTotal == "" || swapFree == "" ||
                swapIn == "" || swapOut == "") exit 1
            printf "%s,%s,%.0f,%s,%s,%s,%s", total, available, swapTotal - swapFree,
                swapIn, swapOut, pressureSome, pressureFull
        }
    ' "$@")
    printf '%s,%s\n' "$timestamp" "$sample"
    sleep "$interval"
done
