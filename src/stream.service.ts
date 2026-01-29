import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { LogService } from './log.service';

@Injectable()
export class StreamService {
  private fileWatchers = new Map<string, { watcher: chokidar.FSWatcher; subject: Subject<MessageEvent> }>();
  private filePositions = new Map<string, number>();

  constructor(private readonly logService: LogService) {}

  watchFile(filePath: string): Observable<MessageEvent> {
    const absolutePath = path.resolve(filePath);

    // If already watching this file, return the existing observable
    if (this.fileWatchers.has(absolutePath)) {
      return this.fileWatchers.get(absolutePath).subject.asObservable();
    }

    const subject = new Subject<MessageEvent>();

    // Initialize file position to end of file if it exists
    if (fs.existsSync(absolutePath)) {
      const stats = fs.statSync(absolutePath);
      this.filePositions.set(absolutePath, stats.size);
    } else {
      this.filePositions.set(absolutePath, 0);
    }

    // Watch for file changes
    const watcher = chokidar.watch(absolutePath, {
      persistent: true,
      ignoreInitial: false,
      usePolling: true,
      interval: 100,
    });

    watcher.on('add', () => {
      // File created, read from beginning
      this.readNewLines(absolutePath, subject);
    });

    watcher.on('change', () => {
      // File modified, read new content
      this.readNewLines(absolutePath, subject);
    });

    watcher.on('error', (error) => {
      console.error('Error watching file:', error);
      subject.error(error);
    });

    this.fileWatchers.set(absolutePath, { watcher, subject });

    return subject.asObservable();
  }

  private readNewLines(filePath: string, subject: Subject<MessageEvent>) {
    try {
      const stats = fs.statSync(filePath);
      const currentPosition = this.filePositions.get(filePath) || 0;

      // Only read if file has grown
      if (stats.size <= currentPosition) {
        return;
      }

      const stream = fs.createReadStream(filePath, {
        start: currentPosition,
        end: stats.size,
        encoding: 'utf8',
      });

      let buffer = '';

      stream.on('data', (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split('\n');

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const entry = JSON.parse(line);
              // Parse the single entry
              const parsed = this.logService.parseLogs(line);
              if (parsed.length > 0) {
                subject.next({ data: parsed[0] });
              }
            } catch (error) {
              console.error('Failed to parse line:', error);
            }
          }
        }
      });

      stream.on('end', () => {
        this.filePositions.set(filePath, stats.size);
      });

      stream.on('error', (error) => {
        console.error('Error reading file:', error);
      });
    } catch (error) {
      console.error('Error reading new lines:', error);
    }
  }

  stopWatching(filePath: string) {
    const absolutePath = path.resolve(filePath);
    const watcherData = this.fileWatchers.get(absolutePath);

    if (watcherData) {
      watcherData.watcher.close();
      watcherData.subject.complete();
      this.fileWatchers.delete(absolutePath);
      this.filePositions.delete(absolutePath);
    }
  }

  stopAll() {
    for (const [filePath] of this.fileWatchers) {
      this.stopWatching(filePath);
    }
  }
}
