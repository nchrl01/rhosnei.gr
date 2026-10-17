#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")" && pwd)"
cd "$repo_root"

required_tools=(
  emcmake
  emmake
  emcc
  dune
  npm
  tsc
  melc
  esbuild
)

missing_tools=()
for tool in "${required_tools[@]}"; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    missing_tools+=("$tool")
  fi
done

if [[ ${#missing_tools[@]} -gt 0 ]]; then
  if [[ "${LIBPD_WASM_BUILD_IN_NIX:-}" != 1 ]] && command -v nix >/dev/null 2>&1; then
    echo "Entering nix develop for missing tools: ${missing_tools[*]}"
    exec env LIBPD_WASM_BUILD_IN_NIX=1 nix develop --command "$0" "$@"
  fi

  printf 'Missing required build tools:' >&2
  printf ' %s' "${missing_tools[@]}" >&2
  printf '\nRun this from direnv/nix develop, or install the missing tools.\n' >&2
  exit 1
fi

step() {
  printf '\n==> %s\n' "$*"
}

step "clean generated build output"
scripts/clean

step "run OCaml parser tests"
(
  cd pd_parse
  dune runtest --force
)

step "build WASM/worklet bundles and object manifest"
scripts/build-wasm

step "install npm dependencies"
(
  cd npm
  npm ci
)

step "run npm build and tests"
(
  cd npm
  npm test
)

step "build demo browser package bundle"
scripts/build-demo-lib

step "verify npm manifest packaging is strict"
(
  cd npm
  npm run build:manifest:strict
)

step "verify npm package contents"
(
  cd npm
  npm pack --dry-run
)
