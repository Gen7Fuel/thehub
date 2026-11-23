#!/bin/sh
set -eu

data_root=/mnt/gen7-data
: "${GEN7_DATA_DISK_UUID:?Set GEN7_DATA_DISK_UUID to the filesystem UUID in /etc/gen7-data-disk.conf}"

if ! actual_uuid=$(/usr/bin/findmnt --noheadings --raw --output UUID --mountpoint "$data_root"); then
    printf '%s\n' "Gen7 data disk is not mounted on $data_root" >&2
    exit 1
fi

if [ "$actual_uuid" != "$GEN7_DATA_DISK_UUID" ]; then
    printf '%s\n' "Unexpected filesystem on $data_root" >&2
    exit 1
fi
