# OpenCode CLI WakaTime Plugin

## Installation

### Option 1: Quick Install (Recommended)

Install the plugin and WakaTime CLI with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/EstebanForge/opencode-cli-wakatime/main/install.sh | bash
```

### Option 2: Manual Install (Offline)

1.  Download `opencode-cli-wakatime.zip` (from releases).
2.  Unzip it.
3.  Run the installer:
    ```bash
    chmod +x install.sh
    ./install.sh
    ```

### Configuration

Add your API key to `~/.wakatime.cfg` if you haven't already:
```ini
[settings]
api_key = your-api-key-here
```

### Restart OpenCode

Run `opencode` in your terminal.

## Usage

*   **Automatic Tracking**: File operations (read/write/edit) are tracked automatically.
*   **Check Status**:
    ```
    /wakatime_status
    ```
    Should show "Installed: true" and "API Key Configured: true".

## Troubleshooting

*   **CLI Not Found**: Run the install script again to ensure the CLI is correctly placed in `~/.wakatime/`.
*   **Manual Install**: If the remote script fails, try Option 2.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.