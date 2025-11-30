import * as path from 'path';
import { FileSystemAdapter } from './adapter';

export interface Setting {
  key: string;
  value: string;
}

export class Options {
  private adapter: FileSystemAdapter;
  private configFile: string;
  private internalConfigFile: string;
  private logFile: string;
  private _resourcesLocation: string;
  private workingDirectory: string;
  private configCache: Map<string, string> = new Map();

  constructor(workingDirectory: string, adapter: FileSystemAdapter) {
    this.workingDirectory = workingDirectory;
    this.adapter = adapter;

    const home = adapter.homedir();
    const wakaFolder = path.join(home, '.wakatime');

    // we can't mkdirSync here, so we assume it exists or create it via shell async later if needed
    // For now, just set the path
    this._resourcesLocation = wakaFolder;

    this.configFile = path.join(home, '.wakatime.cfg');
    this.internalConfigFile = path.join(this._resourcesLocation, 'wakatime-internal.cfg');
    this.logFile = path.join(this._resourcesLocation, 'wakatime.log');
  }

  get resourcesLocation(): string {
    return this._resourcesLocation;
  }

  public async loadConfigs(): Promise<void> {
    try {
      if (await this.adapter.exists(this.configFile)) {
        this.configCache.set(this.configFile, await this.adapter.readFile(this.configFile));
      }
    } catch (e) {}

    try {
      if (await this.adapter.exists(this.internalConfigFile)) {
        this.configCache.set(this.internalConfigFile, await this.adapter.readFile(this.internalConfigFile));
      }
    } catch (e) {}
  }

  public getSetting(section: string, key: string, internal?: boolean): string | undefined {
    const configFile = this.getConfigFile(internal ?? false);
    const content = this.configCache.get(configFile);
    if (!content) return undefined;

    if (content.trim()) {
      let currentSection = '';
      let lines = content.split('\n');
      for (var i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (this.startsWith(line.trim(), '[') && this.endsWith(line.trim(), ']')) {
          currentSection = line
            .trim()
            .substring(1, line.trim().length - 1)
            .toLowerCase();
        } else if (currentSection === section) {
          let parts = line.split('=');
          let currentKey = parts[0].trim();
          if (currentKey === key && parts.length > 1) {
            return this.removeNulls(parts[1].trim());
          }
        }
      }

      return undefined;
    }
  }

  public async setSetting(section: string, key: string, val: string, internal: boolean): Promise<void> {
     // Setting settings is harder without fs.writeFile. 
     // We'll skip implementing write support for now as it's not critical for basic tracking.
     // If needed, we'd use `echo "content" > file` via shell.
     return;
  }

  public getConfigFile(internal: boolean): string {
    return internal ? this.internalConfigFile : this.configFile;
  }

  public getLogFile(): string {
    return this.logFile;
  }

  private startsWith(outer: string, inner: string): boolean {
    return outer.slice(0, inner.length) === inner;
  }

  private endsWith(outer: string, inner: string): boolean {
    return inner === '' || outer.slice(-inner.length) === inner;
  }

  private removeNulls(s: string): string {
    return s.replace(/\0/g, '');
  }
}