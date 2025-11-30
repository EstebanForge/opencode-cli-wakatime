import { Options } from './options';
import { Dependencies } from './dependencies';
import { logger, LogLevel } from './logger';
import { FileSystemAdapter } from './adapter';
import * as path from 'path';
import { Heartbeat } from './types';

export class WakaTimeTracker {
  private options!: Options;
  private dependencies!: Dependencies;
  private adapter: FileSystemAdapter;
  private lastHeartbeatAt: number = 0;
  private fileEntities: Map<string, number> = new Map();
  private workingDirectory: string;
  private apiKey?: string;

  constructor(workingDirectory: string, adapter: FileSystemAdapter) {
    this.workingDirectory = workingDirectory;
    this.adapter = adapter;
  }

  public async initialize() {
    this.options = new Options(this.workingDirectory, this.adapter);
    await this.options.loadConfigs();

    this.dependencies = new Dependencies(this.options, logger, this.adapter);
    this.loadConfig();
    await this.dependencies.checkAndInstallCli();
  }

  private loadConfig() {
    this.apiKey = this.options.getSetting('settings', 'api_key');
    const debug = this.options.getSetting('settings', 'debug');
    logger.setLevel(debug === 'true' ? LogLevel.DEBUG : LogLevel.INFO);
  }

  async trackFileEdit(filePath: string, operation: 'read' | 'write' | 'edit', lineChanges: number = 0) {
    if (!await this.isValidFilePath(filePath)) return;

    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.workingDirectory, filePath);

      if (operation === 'write' || operation === 'edit') {
        const changes = lineChanges || await this.calculateLineChanges(fullPath);
        this.fileEntities.set(fullPath, (this.fileEntities.get(fullPath) || 0) + changes);
      }

      if (this.shouldSendHeartbeat()) {
        await this.sendHeartbeats();
        this.clearEntities();
      }
    } catch (error) {
      logger.error(`Failed to track file operation: ${error}`);
    }
  }

  async trackToolUsage(toolName: string, args: any, output: any) {
    if (toolName === 'read' && args.filePath) {
      await this.trackFileEdit(args.filePath, 'read');
    } else if ((toolName === 'write' || toolName === 'edit') && args.filePath) {
      await this.trackFileEdit(args.filePath, toolName);
    }
  }

  async sendHeartbeat() {
    await this.sendHeartbeats();
    this.clearEntities();
  }

  updateSessionState(sessionData: any) {
    logger.debug(`Session updated: ${JSON.stringify(sessionData)}`);
  }

  async getStatus(): Promise<string> {
    if (!this.dependencies) return "Initializing...";
    
    const cliLocation = await this.dependencies.getCliLocation();
    const isInstalled = await this.dependencies.isCliInstalled();

    return `WakaTime Status:
- API Key: ${this.apiKey ? 'Configured' : 'Not configured'}
- CLI Location: ${cliLocation || 'Not found'}
- CLI Installed: ${isInstalled}
- Pending entities: ${this.fileEntities.size}
- Last heartbeat: ${new Date(this.lastHeartbeatAt * 1000).toISOString()}`;
  }

  private async isValidFilePath(filePath: string): Promise<boolean> {
    return this.adapter.exists(filePath);
  }

  private async calculateLineChanges(filePath: string): Promise<number> {
    try {
      const content = await this.adapter.readFile(filePath);
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }

  private shouldSendHeartbeat(): boolean {
    const now = Date.now() / 1000;
    return now - this.lastHeartbeatAt >= 60;
  }

  private async sendHeartbeats() {
    for (const [entity, changes] of this.fileEntities.entries()) {
      await this.sendSingleHeartbeat(entity, changes);
    }
  }

  private async sendSingleHeartbeat(entity: string, lineChanges: number) {
    logger.debug(`Sending heartbeat for ${entity} with ${lineChanges} line changes`);

    if (!this.apiKey) {
      logger.warn('WakaTime API Key not configured. Skipping heartbeat.');
      return;
    }

    const cliLocation = await this.dependencies.getCliLocation();
    if (!cliLocation || !await this.adapter.exists(cliLocation)) {
      logger.warn('WakaTime CLI not found or not installed. Skipping heartbeat.');
      return;
    }

    const heartbeat: Heartbeat = {
      file: entity,
      timestamp: Date.now() / 1000,
      is_write: true,
    };

    let args = ['--entity', heartbeat.file, '--time', String(heartbeat.timestamp)];
    if (heartbeat.is_write) {
      args.push('--write');
    }

    const env = this.apiKey ? { WAKATIME_API_KEY: this.apiKey } : undefined;

    try {
      // Use adapter to execute command
      const { stdout, stderr } = await this.adapter.exec(cliLocation, args, env);
      
      logger.debug(`WakaTime CLI stdout: ${stdout}`);
      if (stderr) {
        logger.warn(`WakaTime CLI stderr: ${stderr}`);
      }
    } catch (error) {
      logger.error(`Error sending heartbeat with WakaTime CLI: ${error}`);
    }
  }

  private clearEntities() {
    this.fileEntities.clear();
    this.lastHeartbeatAt = Date.now() / 1000;
  }
}
