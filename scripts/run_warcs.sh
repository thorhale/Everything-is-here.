#!/usr/bin/env bash
# Download and process the remaining Archive Team WARC parts sequentially,
# deleting each after processing (34GB total vs ~27GB free disk - only one
# ~5.4GB part is on disk at a time). Resumable: parts already processed are
# recorded in data/warcs/done.txt and skipped on re-run.

set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
mkdir -p data/warcs
touch data/warcs/done.txt

PARTS=(
  "archiveteam_archivebot_go_20181213140004 www.brewtoad.com-inf-20181212-094855-c6930-00000.warc.gz"
  "archiveteam_archivebot_go_20181215070002 www.brewtoad.com-inf-20181212-094855-c6930-00001.warc.gz"
  "archiveteam_archivebot_go_20181217010001 www.brewtoad.com-inf-20181212-094855-c6930-00002.warc.gz"
  "archiveteam_archivebot_go_20181218130001 www.brewtoad.com-inf-20181212-094855-c6930-00003.warc.gz"
  "archiveteam_archivebot_go_20181220040001 www.brewtoad.com-inf-20181212-094855-c6930-00004.warc.gz"
  "archiveteam_archivebot_go_20181223030001 www.brewtoad.com-inf-20181212-094855-c6930-00005.warc.gz"
  "archiveteam_archivebot_go_20181212130001 www.brewtoad.com-shallow-20181212-100126-zn8m6-00000.warc.gz"
)

for entry in "${PARTS[@]}"; do
  item="${entry% *}"
  file="${entry#* }"
  if grep -q "$file" data/warcs/done.txt; then
    echo "== $file: already processed, skipping"
    continue
  fi
  local_path="data/warcs/$file"
  echo "== downloading $file ..."
  if ! curl -sL --retry 3 --retry-delay 10 -o "$local_path" "https://archive.org/download/$item/$file"; then
    echo "== $file: download FAILED, will retry on next run" >&2
    rm -f "$local_path"
    continue
  fi
  echo "== processing $file ..."
  if python3 scraper/warc/process_warc.py "$local_path"; then
    echo "$file" >> data/warcs/done.txt
    rm -f "$local_path"
    echo "== $file: done, deleted"
  else
    echo "== $file: processing FAILED, keeping file for inspection" >&2
  fi
done

echo "== all parts handled; merging staged XML ..."
python3 scraper/warc/process_warc.py --merge-xml
echo "== finished. recipes now: $(wc -l < data/parsed/recipes_full.jsonl)"
