import { z } from 'zod';

export const UtcDateTimeSchema = z.iso.datetime();
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const IsoDateSchema = z.iso.date();

export type UtcDateTime = z.infer<typeof UtcDateTimeSchema>;
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;
export type IsoDate = z.infer<typeof IsoDateSchema>;
