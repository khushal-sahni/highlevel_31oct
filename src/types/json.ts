export type IJsonPrimitive = string | number | boolean | null;

export type IJsonValue = IJsonPrimitive | IJsonObject | readonly IJsonValue[];

export interface IJsonObject {
  readonly [key: string]: IJsonValue | undefined;
}
