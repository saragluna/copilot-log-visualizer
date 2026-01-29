import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LogService } from './log.service';
import { StreamService } from './stream.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [LogService, StreamService],
})
export class AppModule {}
