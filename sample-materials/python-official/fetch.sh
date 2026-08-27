#!/usr/bin/env sh
set -eu

version="3.14"
archive_url="https://docs.python.org/3/archives/python-${version}-docs-text.zip"
expected_sha256="de728eb5b1de8d44ab04f234caeef0bc237bebcb8a6af8a219f35f9d9e35c0c0"
script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
output_dir="$script_dir/generated"
temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT HUP INT TERM

curl --fail --location --silent --show-error "$archive_url" -o "$temporary_dir/docs.zip"
actual_sha256="$(sha256sum "$temporary_dir/docs.zip" | cut -d ' ' -f 1)"
test "$actual_sha256" = "$expected_sha256"

mkdir -p "$output_dir"
unzip -p "$temporary_dir/docs.zip" "python-${version}-docs-text/license.txt" \
  > "$output_dir/PSF-LICENSE.txt"

{
  echo "Python ${version} Tutorial"
  echo
  echo "Source: $archive_url"
  echo "Copyright © 2001 Python Software Foundation; All Rights Reserved"
  echo "License: Python Software Foundation License Version 2"
  echo "Changes: official tutorial text files concatenated in filename order; this attribution header added."
  echo
  unzip -Z1 "$temporary_dir/docs.zip" \
    | grep "^python-${version}-docs-text/tutorial/.*\\.txt$" \
    | sort \
    | while IFS= read -r entry; do
        printf '\n\n===== %s =====\n\n' "${entry##*/}"
        unzip -p "$temporary_dir/docs.zip" "$entry"
      done
} > "$output_dir/python-${version}-tutorial.txt"

echo "Created $output_dir/python-${version}-tutorial.txt"
