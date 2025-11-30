import * as path from 'path';
import { Options } from './options';
import { Logger } from './logger';
import { FileSystemAdapter } from './adapter';

export class Dependencies {
  private options: Options;
  private logger: Logger;
  private adapter: FileSystemAdapter;
  private resourcesLocation: string;
  private cliLocation?: string = undefined;

  constructor(options: Options, logger: Logger, adapter: FileSystemAdapter) {
    this.options = options;
    this.logger = logger;
    this.adapter = adapter;
    this.resourcesLocation = options.resourcesLocation;
  }

  public async getCliLocation(): Promise<string> {
    if (this.cliLocation) return this.cliLocation;

    const simpleBinary = 'wakatime-cli';
    
    // 1. Check local ~/.wakatime/wakatime-cli
    const localCliPath = path.join(this.resourcesLocation, simpleBinary);
    if (await this.adapter.exists(localCliPath)) {
      this.cliLocation = localCliPath;
      this.logger.debug(`Found CLI at local path: ${localCliPath}`);
      return this.cliLocation;
    }

    // 2. Check common global brew paths
    const brewCliPath = `/opt/homebrew/bin/${simpleBinary}`;
    if (await this.adapter.exists(brewCliPath)) {
        this.cliLocation = brewCliPath;
        this.logger.debug(`Found CLI at brew path: ${brewCliPath}`);
        return this.cliLocation;
    }
    
    const oldBrewCliPath = `/usr/local/bin/${simpleBinary}`;
    if (await this.adapter.exists(oldBrewCliPath)) {
        this.cliLocation = oldBrewCliPath;
        this.logger.debug(`Found CLI at old brew path: ${oldBrewCliPath}`);
        return this.cliLocation;
    }

    this.cliLocation = '';
    return this.cliLocation;
  }

  public async isCliInstalled(): Promise<boolean> {
    const cliPath = await this.getCliLocation();
    return !!cliPath && (await this.adapter.exists(cliPath));
  }

  public async checkAndInstallCli(callback?: () => void): Promise<void> {
    this.logger.debug("Checking WakaTime CLI...");
    if (await this.isCliInstalled()) {
      this.logger.debug("CLI found.");
    } else {
      this.logger.warn("WakaTime CLI not found. Please install it manually.");
    }
    callback?.();
  }
}
