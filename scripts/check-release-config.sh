#!/usr/bin/env bash
set -euo pipefail

test -f .github/workflows/release.yml
test -f build/darwin/Info.plist
test -f build/darwin/entitlements.plist
test -f build/windows/installer.nsi
test -f build/windows/wails.exe.manifest
test -f build/windows/info.json

ruby -ryaml -rjson -rrexml/document -e '
  workflow = YAML.load_file(".github/workflows/release.yml")
  expected_jobs = ["license-inventory", "macos-universal", "publish-release", "windows-x64"]
  abort "release workflow has unexpected jobs" unless workflow["jobs"].is_a?(Hash) && workflow["jobs"].keys.sort == expected_jobs
  YAML.load_file("api/openapi.yaml")
  JSON.parse(File.read("build/windows/info.json"))
  REXML::Document.new(File.read("build/darwin/Info.plist"))
  REXML::Document.new(File.read("build/darwin/entitlements.plist"))
  puts "release configuration parses"
'

grep -q 'lipo -create' .github/workflows/release.yml
grep -q 'makensis' .github/workflows/release.yml
grep -q 'notarytool submit' .github/workflows/release.yml
