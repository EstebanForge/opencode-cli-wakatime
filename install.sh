#!/usr/bin/env bash

# OpenCode WakaTime Plugin - Unified Installer

set -e

REPO_OWNER="EstebanForge"
REPO_NAME="opencode-cli-wakatime"
GITHUB_RELEASE_URL="https://github.com/$REPO_OWNER/$REPO_NAME/releases/latest/download/$REPO_NAME.zip"

# --- Part 1: WakaTime CLI Installation ---

WAKATIME_DIR="$HOME/.wakatime"
CLI_FILE="$WAKATIME_DIR/wakatime-cli"

echo "--- Checking WakaTime CLI ---"

if [ -f "$CLI_FILE" ]; then
  echo "✅ WakaTime CLI already exists at $CLI_FILE."
else
  echo "⬇️  WakaTime CLI not found. Downloading..."
  mkdir -p "$WAKATIME_DIR"

  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)

  if [[ "$ARCH" == "x86_64" ]]; then
    ARCH="amd64"
  elif [[ "$ARCH" == "arm64" ]]; then
    ARCH="arm64"
  else
    echo "❌ Unsupported architecture: $ARCH"
    exit 1
  fi

  if [[ "$OS" == "darwin" ]]; then
    OS="darwin"
  elif [[ "$OS" == "linux" ]]; then
    OS="linux"
  fi

  URL="https://github.com/wakatime/wakatime-cli/releases/latest/download/wakatime-cli-${OS}-${ARCH}.zip"
  ZIP_FILE="$WAKATIME_DIR/wakatime-cli.zip"

  echo "Downloading from $URL..."
  curl -L "$URL" -o "$ZIP_FILE"

  echo "Extracting..."
  unzip -o "$ZIP_FILE" -d "$WAKATIME_DIR"

  rm "$ZIP_FILE"
  chmod +x "$CLI_FILE"

  echo "✅ WakaTime CLI installed."
fi

# --- Part 2: Plugin Installation ---

echo ""
echo "--- Installing OpenCode Plugin ---"

PLUGIN_DEST="$HOME/.config/opencode/plugin"
OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
LOCAL_PLUGIN_SRC=".opencode/plugin"

install_local() {
  echo "📂 Found local plugin files."
  if [ -f "$LOCAL_PLUGIN_SRC/wakatime.ts" ]; then
      PLUGIN_FILE="$LOCAL_PLUGIN_SRC/wakatime.ts"
  else
      echo "❌ Error: Local plugin file 'wakatime.ts' not found in $LOCAL_PLUGIN_SRC."
      exit 1
  fi

  mkdir -p "$PLUGIN_DEST"
  echo "Copying plugin file to $PLUGIN_DEST..."
  cp "$PLUGIN_FILE" "$PLUGIN_DEST/wakatime.ts"

  CONFIG_JSON="$OPENCODE_CONFIG_DIR/opencode.json"
  CONFIG_JSONC="$OPENCODE_CONFIG_DIR/opencode.jsonc"

  if [ -f "$CONFIG_JSON" ] || [ -f "$CONFIG_JSONC" ]; then
    EXISTING_CONFIG="$CONFIG_JSON"
    if [ -f "$CONFIG_JSONC" ]; then
      EXISTING_CONFIG="$CONFIG_JSONC"
    fi
    echo ""
    echo "ℹ️  Detected existing OpenCode config: $EXISTING_CONFIG"
    echo "    Please ensure it includes the WakaTime plugin entry, for example:"
    echo "      \"plugin\": [\"./plugin/wakatime.ts\", ...]"
  else
    if [ -f ".opencode/opencode.jsonc" ]; then
      echo "Seeding OpenCode config with WakaTime plugin..."
      mkdir -p "$OPENCODE_CONFIG_DIR"
      cp ".opencode/opencode.jsonc" "$OPENCODE_CONFIG_DIR/opencode.jsonc"
    fi
  fi
  echo "✅ Plugin installed successfully."
}

install_remote() {
  echo "🌐 Local plugin files not found. Downloading from GitHub..."

  TEMP_DIR=$(mktemp -d)
  ZIP_FILE="$TEMP_DIR/plugin.zip"

  echo "Downloading release from $GITHUB_RELEASE_URL..."
  if ! curl -L --fail "$GITHUB_RELEASE_URL" -o "$ZIP_FILE"; then
    echo "❌ Failed to download plugin. Check internet connection or release availability."
    rm -rf "$TEMP_DIR"
    exit 1
  fi

  # Check validity
  if ! head -c 4 "$ZIP_FILE" | grep -q "PK"; then
      echo "❌ Error: Downloaded file is not a valid zip archive."
      rm -rf "$TEMP_DIR"
      exit 1
  fi

  echo "Extracting..."
  if ! unzip -o -q "$ZIP_FILE" -d "$TEMP_DIR"; then
      echo "❌ Error: Failed to extract zip file."
      rm -rf "$TEMP_DIR"
      exit 1
  fi

  # Find wakatime.ts recursively
  PLUGIN_FILE=$(find "$TEMP_DIR" -name "wakatime.ts" | head -n 1)

    if [ -z "$PLUGIN_FILE" ]; then
        echo "❌ Error: Plugin file 'wakatime.ts' not found in the downloaded zip."
        echo "Contents of extraction directory (recursive):"
        ls -R -a "$TEMP_DIR"
        rm -rf "$TEMP_DIR"
        exit 1
    fi

  mkdir -p "$PLUGIN_DEST"
  echo "Copying plugin file to $PLUGIN_DEST..."
  cp "$PLUGIN_FILE" "$PLUGIN_DEST/wakatime.ts"

  CONFIG_JSON="$OPENCODE_CONFIG_DIR/opencode.json"
  CONFIG_JSONC="$OPENCODE_CONFIG_DIR/opencode.jsonc"

  if [ -f "$CONFIG_JSON" ] || [ -f "$CONFIG_JSONC" ]; then
    EXISTING_CONFIG="$CONFIG_JSON"
    if [ -f "$CONFIG_JSONC" ]; then
      EXISTING_CONFIG="$CONFIG_JSONC"
    fi
    echo ""
    echo "ℹ️  Detected existing OpenCode config: $EXISTING_CONFIG"
    echo "    Please ensure it includes the WakaTime plugin entry, for example:"
    echo "      \"plugin\": [\"./plugin/wakatime.ts\", ...]"
  else
    CONFIG_FILE=$(find "$TEMP_DIR" -name "opencode.jsonc" 2>/dev/null | head -n 1)
    if [ -n "$CONFIG_FILE" ]; then
      echo "Seeding OpenCode config with WakaTime plugin..."
      mkdir -p "$OPENCODE_CONFIG_DIR"
      cp "$CONFIG_FILE" "$OPENCODE_CONFIG_DIR/opencode.jsonc"
    fi
  fi
  echo "✅ Plugin installed successfully."
  rm -rf "$TEMP_DIR"
}

if [ -d "$LOCAL_PLUGIN_SRC" ]; then
  install_local
else
  install_remote
fi

echo ""
echo "🎉 Done! Please restart OpenCode to activate the plugin."
