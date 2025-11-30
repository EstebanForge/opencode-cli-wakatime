export interface FileSystemAdapter {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  exec(command: string, args: string[], env?: Record<string, string>): Promise<{ stdout: string; stderr: string }>;
  homedir(): string;
  join(...paths: string[]): string;
}
