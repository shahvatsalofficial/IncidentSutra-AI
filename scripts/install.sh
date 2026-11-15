#!/bin/sh
set -eu
node "$(dirname "$0")/../packages/cli/index.mjs" skills install --host "${1:-claude}" --project "${2:-.}"
