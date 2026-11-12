#!/usr/bin/env bash
# Run the dev server, and start it again whenever it exits (killed, crashed or stopped).
# Ctrl-C in this window ends the loop.
#
#   yarn dev_loop          port 5174
#   yarn dev_loop 5180     another port
#
# The port is fixed (--strictPort) so a restart comes back where it was; while the old server
# still holds it, the new one fails and is retried a second later.
set -u

port="${1:-5174}"
case "$port" in (*[!0-9]*|'') echo "usage: yarn dev_loop [port]" >&2; exit 2 ;; esac

stop=0
trap 'stop=1' INT TERM

export WYATT_SEED="${WYATT_SEED:-sample}"
while [ "$stop" -eq 0 ]; do
	echo "dev_loop: starting the dev server on port $port ($(date '+%H:%M:%S'))"
	vite dev --port "$port" --strictPort
	status=$?
	[ "$stop" -ne 0 ] && break
	echo "dev_loop: the server exited ($status); restarting in 1s. Ctrl-C to stop."
	sleep 1
done
echo "dev_loop: stopped."
