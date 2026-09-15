import { Module } from '@nestjs/common';
import { AlianzasController } from './alianzas.controller';

@Module({ controllers: [AlianzasController] })
export class AlianzasModule {}
