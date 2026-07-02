#!/bin/bash

# After-install script for Fedora/RHEL/openSUSE (RPM).
# Merges the standard electron-builder post-install logic with
# the TeacherAgent-ex setup.

# ── Standard electron-builder post-install logic ──────────────────────────────

# Create /usr/bin symlink via update-alternatives
if type update-alternatives >/dev/null 2>&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/teacheragent-ex' -a -e '/usr/bin/teacheragent-ex' -a "$(readlink '/usr/bin/teacheragent-ex')" != '/etc/alternatives/teacheragent-ex' ]; then
        rm -f '/usr/bin/teacheragent-ex'
    fi
    update-alternatives --install '/usr/bin/teacheragent-ex' 'teacheragent-ex' '/opt/TeacherAgent-ex/teacheragent-ex' 100 || ln -sf '/opt/TeacherAgent-ex/teacheragent-ex' '/usr/bin/teacheragent-ex'
else
    ln -sf '/opt/TeacherAgent-ex/teacheragent-ex' '/usr/bin/teacheragent-ex'
fi

# Set chrome-sandbox permissions
if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    chmod 4755 '/opt/TeacherAgent-ex/chrome-sandbox' || true
else
    chmod 0755 '/opt/TeacherAgent-ex/chrome-sandbox' || true
fi

# Activate MIME type recognition for .elpx/.elp files
if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

# Activate .desktop file association
if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

# Install AppArmor profile (Ubuntu 24+)
if apparmor_status --enabled > /dev/null 2>&1; then
  APPARMOR_PROFILE_SOURCE='/opt/TeacherAgent-ex/resources/apparmor-profile'
  APPARMOR_PROFILE_TARGET='/etc/apparmor.d/teacheragent-ex'
  if apparmor_parser --skip-kernel-load --debug "$APPARMOR_PROFILE_SOURCE" > /dev/null 2>&1; then
    cp -f "$APPARMOR_PROFILE_SOURCE" "$APPARMOR_PROFILE_TARGET"

    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      apparmor_parser --replace --write-cache --skip-read-cache "$APPARMOR_PROFILE_TARGET"
    fi
  else
    echo "Skipping the installation of the AppArmor profile as this version of AppArmor does not seem to support the bundled profile"
  fi
fi

