import { type Plugin, tool } from "@opencode-ai/plugin"
import * as path from 'path'

// --- Adapter Interface ---
interface FileSystemAdapter {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  exec(command: string, args: string[], env?: Record<string, string>): Promise<{ stdout: string; stderr: string }>;
  homedir(): string;
  join(...paths: string[]): string;
}

// --- Logger ---
enum LogLevel { DEBUG = 0, INFO, WARN, ERROR }
class Logger {
  private level: LogLevel = LogLevel.INFO;
  setLevel(level: LogLevel) { this.level = level; }
  debug(msg: string) { if (this.level <= LogLevel.DEBUG) console.log(`[DEBUG] ${msg}`); }
  info(msg: string) { if (this.level <= LogLevel.INFO) console.log(`[INFO] ${msg}`); }
  warn(msg: string) { if (this.level <= LogLevel.WARN) console.warn(`[WARN] ${msg}`); }
  error(msg: string) { if (this.level <= LogLevel.ERROR) console.error(`[ERROR] ${msg}`); }
}
const logger = new Logger();

// --- Options ---
class Options {
  private adapter: FileSystemAdapter;
  private configFile: string;
  private _resourcesLocation: string;
  private configCache: Map<string, string> = new Map();

  constructor(adapter: FileSystemAdapter) {
    this.adapter = adapter;
    const home = adapter.homedir();
    this._resourcesLocation = path.join(home, '.wakatime');
    this.configFile = path.join(home, '.wakatime.cfg');
  }

  get resourcesLocation() { return this._resourcesLocation; }

  async loadConfigs() {
    try {
      if (await this.adapter.exists(this.configFile)) {
        this.configCache.set(this.configFile, await this.adapter.readFile(this.configFile));
      }
    } catch {}
  }

  getSetting(section: string, key: string): string | undefined {
    const content = this.configCache.get(this.configFile);
    if (!content) return undefined;

    let currentSection = '';
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.substring(1, trimmed.length - 1).toLowerCase();
      } else if (currentSection === section) {
        const parts = trimmed.split('=');
        if (parts[0].trim() === key && parts.length > 1) {
          return parts[1].trim();
        }
      }
    }
    return undefined;
  }
}

// --- Dependencies ---
class Dependencies {
  private options: Options;
  private logger: Logger;
  private adapter: FileSystemAdapter;
  private cliLocation?: string;

  constructor(options: Options, logger: Logger, adapter: FileSystemAdapter) {
    this.options = options;
    this.logger = logger;
    this.adapter = adapter;
  }

  async getCliLocation(): Promise<string> {
    if (this.cliLocation) return this.cliLocation;
    const binary = 'wakatime-cli';

    const pathsToCheck = [
      path.join(this.options.resourcesLocation, binary),
      `/opt/homebrew/bin/${binary}`,
      `/usr/local/bin/${binary}`
    ];

    for (const p of pathsToCheck) {
      if (await this.adapter.exists(p)) {
        this.cliLocation = p;
        this.logger.debug(`Found CLI at: ${p}`);
        return p;
      }
    }
    return '';
  }

  async isCliInstalled() {
    const loc = await this.getCliLocation();
    return !!loc;
  }

  async checkAndInstallCli() {
    if (await this.isCliInstalled()) {
      this.logger.debug("CLI found.");
    } else {
      this.logger.warn("CLI not found. Please install manually.");
    }
  }
}

// --- WakaTimeTracker ---
class WakaTimeTracker {
  private options: Options;
  private dependencies: Dependencies;
  private adapter: FileSystemAdapter;
  private lastHeartbeatAt = 0;
  private fileEntities = new Map<string, number>();
  private workingDirectory: string;
  private apiKey?: string;

  constructor(workingDirectory: string, adapter: FileSystemAdapter) {
    this.workingDirectory = workingDirectory;
    this.adapter = adapter;
    this.options = new Options(adapter);
    this.dependencies = new Dependencies(this.options, logger, adapter);
  }

  async initialize() {
    await this.options.loadConfigs();
    this.apiKey = this.options.getSetting('settings', 'api_key');
    const debug = this.options.getSetting('settings', 'debug');
    logger.setLevel(debug === 'true' ? LogLevel.DEBUG : LogLevel.INFO);
    await this.dependencies.checkAndInstallCli();
  }

  async trackFileEdit(filePath: string, operation: 'read' | 'write' | 'edit', lineChanges = 0) {
     const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.workingDirectory, filePath);
     if (!await this.adapter.exists(fullPath)) return;

     if (operation === 'write' || operation === 'edit') {
       const changes = lineChanges || 1;
       this.fileEntities.set(fullPath, (this.fileEntities.get(fullPath) || 0) + changes);
     }

     if (Date.now() / 1000 - this.lastHeartbeatAt >= 60) {
       await this.sendHeartbeats();
       this.fileEntities.clear();
       this.lastHeartbeatAt = Date.now() / 1000;
     }
  }

  async trackToolUsage(toolName: string, args: any, output: any) {
      if (!args) return;

      // Defensive argument checking
      const filePath = args.filePath || args.file_path || args.path;
      if (!filePath || typeof filePath !== 'string') return;

      if (toolName === 'read' || toolName === 'read_file') {
          await this.trackFileEdit(filePath, 'read');
      } else if (toolName === 'write' || toolName === 'write_file' || toolName === 'edit' || toolName === 'replace') {
          await this.trackFileEdit(filePath, toolName as any);
      }
  }

  async sendHeartbeat() {
    await this.sendHeartbeats();
    this.fileEntities.clear();
    this.lastHeartbeatAt = Date.now() / 1000;
  }

  async sendHeartbeats() {
    for (const [entity, changes] of this.fileEntities.entries()) {
      await this.sendSingleHeartbeat(entity, changes);
    }
  }

  async sendSingleHeartbeat(entity: string, changes: number) {
    if (!this.apiKey) return;
    const cli = await this.dependencies.getCliLocation();
    if (!cli) return;

    const args = ['--entity', entity, '--time', String(Date.now()/1000), '--write'];
    const env = { WAKATIME_API_KEY: this.apiKey };
    try {
      await this.adapter.exec(cli, args, env);
    } catch (e) {
      logger.error(`Heartbeat failed: ${e}`);
    }
  }

  async getStatus() {
      const installed = await this.dependencies.isCliInstalled();
      const loc = await this.dependencies.getCliLocation();
      return `WakaTime Status:\n- Installed: ${installed}\n- Path: ${loc}\n- API Key Configured: ${!!this.apiKey}`;
  }
}

// --- Plugin Entry ---
export const WakaTimePlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  console.log("WakaTime plugin initialized (Bundled Mode)")

  const adapter: FileSystemAdapter = {
    async exists(p) { try { await $`test -e ${p}`; return true; } catch { return false; } },
    async readFile(p) { try { const r = await $`cat ${p}`.quiet(); return r.text(); } catch { return ""; } },
    async exec(cmd, args, env) {
        try {
            // Bun shell handles array args nicely
            let shellCmd = $`${cmd} ${args}`.quiet();
            if (env) {
              shellCmd = shellCmd.env(env);
            }
            const res = await shellCmd;
            return { stdout: res.stdout.toString(), stderr: res.stderr.toString() };
        } catch (e: any) {
            return { stdout: e.stdout?.toString() || '', stderr: e.stderr?.toString() || e.message };
        }
    },
    homedir() { return process.env.HOME || '/'; },
    join(...p) { return path.join(...p); }
  };

  const tracker = new WakaTimeTracker(directory, adapter);

  try {
    await tracker.initialize();
  } catch(e) {
      console.error("Initialization error:", e);
  }

  return {
    event: async ({ event }) => {
      if (!event) return;
      if (event.type === "file.edited") {
        const file = (event as any).properties?.file;
        if (file && typeof file === "string") {
          await tracker.trackFileEdit(file, "edit");
        }
      }
    },
    "tool.execute.before": async (i, o) => {
        if (!i || !i.tool) return;
        await tracker.trackToolUsage(i.tool, o.args, o);
    },
    "session.idle": async () => tracker.sendHeartbeat(),
    "tool": {
        "wakatime_status": tool({
            description: "Get current WakaTime tracking status",
            args: {},
            async execute() { return { content: [{ type: "text", text: await tracker.getStatus() }] }; }
        })
    }
  };
}
