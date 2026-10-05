import { supabase } from '../lib/supabase';
import type { PreRequest } from './storage';

export type SandboxEmailEvent =
  | 'PRE_REQUEST_CREATED'
  | 'PAYMENT_INFORMED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_NOT_FOUND'
  | 'CANCELLATION_REQUESTED'
  | 'PRE_REQUEST_CANCELLED'
  | 'PRE_REQUEST_EXPIRED'
  | 'REFUND_COMPLETED';

export async function sendSandboxEmail(event: SandboxEmailEvent, row: PreRequest) {
  if (!row.email) {
    return { success: true, skipped: true, reason: 'Pré-solicitação sem e-mail.' };
  }

  const { data, error } = await supabase.functions.invoke('camisa-sandbox-email', {
    body: {
      event,
      to: row.email,
      protocol: row.protocol,
      officialCode: row.officialCode,
      requesterName: row.requesterName,
      beneficiaryName: row.beneficiaryName,
      totalAmount: row.totalAmount,
      expiresAt: row.expiresAt,
      paymentDate: row.paymentDate,
      cancellationReason: row.cancellationReason,
    },
  });

  if (error) throw new Error(error.message);
  if (data?.success === false) throw new Error(data.error || 'Falha no e-mail de homologação.');
  return data;
}
