export type PixInput = {
  key: string;
  receiverName: string;
  receiverCity: string;
  amount: number;
  txid: string;
};

function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function normalize(value: string, max: number) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .\-/]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, max);
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixCopyPaste(input: PixInput) {
  const merchantAccount = field('00', 'BR.GOV.BCB.PIX') + field('01', input.key.trim());
  const additional = field('05', normalize(input.txid || '***', 25) || '***');

  const payloadWithoutCrc =
    field('00', '01') +
    field('26', merchantAccount) +
    field('52', '0000') +
    field('53', '986') +
    field('54', input.amount.toFixed(2)) +
    field('58', 'BR') +
    field('59', normalize(input.receiverName, 25)) +
    field('60', normalize(input.receiverCity, 15)) +
    field('62', additional) +
    '6304';

  return payloadWithoutCrc + crc16(payloadWithoutCrc);
}
