#!/bin/bash

# After-remove script for Fedora/RHEL/openSUSE (RPM).
# Merges standard electron-builder cleanup with repository removal.

# ── Standard electron-builder cleanup ─────────────────────────────────────────

# Remove /usr/bin symlink
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove 'teacheragent-ex' '/usr/bin/teacheragent-ex'
else
    rm -f '/usr/bin/teacheragent-ex'
fi

# Remove AppArmor profile
APPARMOR_PROFILE_DEST='/etc/apparmor.d/teacheragent-ex'
if [ -f "$APPARMOR_PROFILE_DEST" ]; then
  rm -f "$APPARMOR_PROFILE_DEST"
fi

# ── YUM/DNF repository cleanup ───────────────────────────────────────

# Remove repo file
rm -f /etc/yum.repos.d/teacheragent-ex.repo

# Remove GPG key
rm -f /etc/pki/rpm-gpg/RPM-GPG-KEY-teacheragent-ex

