// Shop settings rules, shared by the server and the admin Settings form.
import { z } from 'zod'

z.config({ jitless: true }) // the CSP forbids eval

const lkr = (label, max) =>
  z.coerce.number({ error: (i) => (i.code === 'invalid_type' ? `${label} must be a number` : undefined) }).int(`${label} must be a whole number`).min(0, `${label} can’t be negative`).max(max, `${label} is too high`)

export const settingsSchema = z
  .object({
    deliveryFees: z.object({ colombo: lkr('Colombo delivery', 10_000), outstation: lkr('Outstation delivery', 10_000) }),
    freeDeliveryOver: lkr('Free delivery amount', 1_000_000),
    payments: z.object({ cod: z.boolean(), bank: z.boolean(), online: z.boolean() }),
    bankDetails: z.string().trim().max(400, 'Bank details are too long'),
    holdHours: z.coerce.number().int().min(1, 'Hold at least 1 hour').max(168, 'Hold at most 7 days (168 hours)'),
    onlineHoldMinutes: z.coerce.number().int().min(15, 'Hold online orders at least 15 minutes').max(1440, 'At most 24 hours'),
  })
  .superRefine((s, ctx) => {
    if (!s.payments.cod && !s.payments.bank && !s.payments.online)
      ctx.addIssue({ code: 'custom', path: ['payments'], message: 'Keep at least one payment method on' })
  })
