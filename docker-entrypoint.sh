#!/bin/sh
set -e

mkdir -p /app/server/data/favicons /app/server/data/uploads

if [ "$(id -u)" = '0' ]; then
    chown -R node:node /app/server/data
    exec su-exec node "$@"
fi

exec "$@"
