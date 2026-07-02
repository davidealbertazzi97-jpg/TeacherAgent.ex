#!/bin/bash

# After-remove script for Debian/Ubuntu (DEB).
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

# ── APT repository cleanup ───────────────────────────────────────

# Remove APT source list
rm -f /etc/apt/sources.list.d/teacheragent-ex.list

# Remove GPG key
rm -f /usr/share/keyrings/teacheragent-ex.gpg
rm -f /etc/apt/keyrings/teacheragent-ex.gpg

