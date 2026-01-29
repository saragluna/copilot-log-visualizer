import { Controller, Get, Post, Body, Res, Sse, Query, MessageEvent } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { LogService, ParsedRequest } from './log.service';
import { StreamService } from './stream.service';

@Controller()
export class AppController {
  constructor(
    private readonly logService: LogService,
    private readonly streamService: StreamService,
  ) {}

  @Get()
  root(@Res() res: Response) {
    return res.sendFile('index.html', { root: './public' });
  }

  @Post('/parse')
  parseLogs(@Body() body: { content: string }): ParsedRequest[] {
    return this.logService.parseLogs(body.content);
  }

  @Sse('/stream')
  streamLogs(@Query('file') file?: string): Observable<MessageEvent> {
    const filePath = file || 'out.jsonl';
    return this.streamService.watchFile(filePath);
  }
}
