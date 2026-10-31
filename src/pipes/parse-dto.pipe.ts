import { PipeTransform } from '@nestjs/common';
import { IJsonObject } from '../types/json';
import { requireRecord } from '../utils/parse';

export class ParseDtoPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly parse: (body: IJsonObject) => T) {}

  transform(value: unknown): T {
    return this.parse(requireRecord(value));
  }
}
