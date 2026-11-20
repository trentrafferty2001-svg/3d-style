#!/bin/bash
# Render frame blocks at native 1080x1920 (FPS, default 30) into near-lossless masters. Skips finished blocks.
# usage: ENGINE=/home/claude/ricefish_dm PARTS=/home/claude/parts_dm FPS=30 bash render30.sh "id firstFrame endFrame" ...
cd "${ENGINE:?}" || exit 1
FPS=${FPS:-30}; mkdir -p "${PARTS:?}"; P=$(cd "$PARTS" && pwd)
export RES=1080 CRF=10 PRESET=fast GL=swiftshader
for spec in "$@"; do
  set -- $spec
  [ -s "$P/$1.done" ] && continue
  from=$(python3 -c "print($2/$FPS)"); to=$(python3 -c "print($3/$FPS + 0.0001)")
  if node render.mjs video "$P/$1.mp4" $FPS $from $to > "$P/$1.log" 2>&1; then echo ok > "$P/$1.done"; echo "block $1 done $(date +%T)" >> "$P/progress.log"
  else echo "block $1 FAILED $(date +%T)" >> "$P/progress.log"; fi
done
