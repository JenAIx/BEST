#!/bin/bash
set -eu

# SSH connection details
SSH_USER="ubuntu"
SSH_HOST="138.2.147.185"
SSH_KEY="$HOME/.ssh/ssh-key-2025-03-08.key"   # absoluter Pfad ($HOME statt ~, sonst nicht expandiert)

# Local source directory (frischer PWA-Build) und Remote-Webroot
LOCAL_DIR="./dist/pwa"
REMOTE_DIR="/home/ubuntu/MyProjects/SERVER_STE_2025/www/surveybest"

if [ ! -f "$LOCAL_DIR/index.html" ]; then
  echo "FEHLER: $LOCAL_DIR/index.html fehlt — erst 'npm run build' ausführen." >&2
  exit 1
fi

# Zielverzeichnis sicherstellen
ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" "mkdir -p $REMOTE_DIR"

# Sauberer Mirror, damit keine veralteten Build-Artefakte (alte Service-Worker/
# workbox/Hash-Chunks) zurückbleiben.
if command -v rsync >/dev/null 2>&1; then
  # bevorzugt: atomar transferieren, dann verwaiste Dateien löschen
  rsync -az --delete -e "ssh -i $SSH_KEY" "$LOCAL_DIR"/ "$SSH_USER@$SSH_HOST:$REMOTE_DIR/"
else
  # Fallback ohne rsync: Remote leeren, dann frischen Build kopieren
  echo "rsync nicht vorhanden -> Fallback: Remote leeren + scp"
  ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" "rm -rf '$REMOTE_DIR'/* '$REMOTE_DIR'/.[!.]* 2>/dev/null; mkdir -p '$REMOTE_DIR'"
  scp -C -i "$SSH_KEY" -r "$LOCAL_DIR"/* "$SSH_USER@$SSH_HOST:$REMOTE_DIR/"
fi

echo 'Upload erfolgreich'
