import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const requiredNumber = z.preprocess(
  (s) => (s === '' || s == null ? undefined : Number(s)),
  z.number().refine((n) => Number.isFinite(n), { message: 'must be a finite number' })
);

const optionalNullableNumber = z.preprocess(
  (s) => (s === '' || s == null ? null : Number(s)),
  z.number().refine((n) => Number.isFinite(n), { message: 'must be a finite number' }).nullable()
);

const isoDate = z.string().regex(ISO_DATE, { message: 'must be YYYY-MM-DD' });

const optionalIsoDate = z.preprocess(
  (s) => (s === '' || s == null ? null : s),
  z.string().regex(ISO_DATE, { message: 'must be YYYY-MM-DD or empty' }).nullable()
);

export const paramRowSchema = z
  .object({
    id: z.string().min(1, { message: 'empty id' }),
    name: z.string().min(1, { message: 'empty name' }),
    short: z.string(),
    unit: z.string(),
    lo: optionalNullableNumber,
    hi: requiredNumber,
  })
  .refine((r) => r.hi > 0, { message: 'hi must be > 0', path: ['hi'] })
  .refine((r) => r.lo === null || r.hi > r.lo, {
    message: 'hi must be > lo',
    path: ['hi'],
  });

export const resultRowSchema = z
  .object({
    date: isoDate,
    param_id: z.string().min(1, { message: 'empty param_id' }),
    value: requiredNumber,
  })
  .transform((r) => ({ date: r.date, paramId: r.param_id, value: r.value }));

export const eventRowSchema = z
  .object({
    id: z.string().min(1, { message: 'empty id' }),
    date: isoDate,
    date_to: optionalIsoDate,
    label: z.string().min(1, { message: 'empty label' }),
  })
  .refine((r) => r.date_to === null || r.date_to > r.date, {
    message: 'date_to must be strictly after date',
    path: ['date_to'],
  })
  .transform((r) => ({ id: r.id, date: r.date, dateTo: r.date_to, label: r.label }));

function uniqueIds<T extends { id: string }>(rows: T[], ctx: z.RefinementCtx, label: string): void {
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    if (seen.has(row.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `duplicate ${label} "${row.id}"`,
        path: [i, 'id'],
      });
    }
    seen.add(row.id);
  });
}

export const paramsSchema = z.array(paramRowSchema).superRefine((rows, ctx) => {
  uniqueIds(rows, ctx, 'id');
});

export const resultsSchema = z.array(resultRowSchema);

export const eventsSchema = z.array(eventRowSchema).superRefine((rows, ctx) => {
  uniqueIds(rows, ctx, 'id');
});

export type Param = z.infer<typeof paramRowSchema>;
export type Result = z.infer<typeof resultRowSchema>;
export type EventAnno = z.infer<typeof eventRowSchema>;
