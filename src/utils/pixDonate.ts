import QRCode from 'qrcode';

export const PIX_KEY = 'e446b945-e755-4510-a1e3-12535f93bdce';
export const PAYPAL_EMAIL = 'jean.pimenta@protonmail.com';

function emvField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildPixBrCode(description: string): string {
  const cleanDesc = description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ._-]/g, '')
    .slice(0, 25);
  const txid = cleanDesc.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || '***';

  const mai =
    emvField('00', 'br.gov.bcb.pix') +
    emvField('01', PIX_KEY) +
    (cleanDesc ? emvField('02', cleanDesc) : '');

  const withoutCrc =
    emvField('00', '01') +
    emvField('26', mai) +
    emvField('52', '0000') +
    emvField('53', '986') +
    emvField('58', 'BR') +
    emvField('59', 'JEAN PIMENTA') +
    emvField('60', 'BRASIL') +
    emvField('62', emvField('05', txid)) +
    '6304';

  return `${withoutCrc}${crc16Ccitt(withoutCrc)}`;
}

export async function generatePixQrDataUrl(description: string): Promise<{
  brCode: string;
  qrUrl: string;
}> {
  const brCode = buildPixBrCode(description);
  const qrUrl = await QRCode.toDataURL(brCode, {
    width: 176,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  return { brCode, qrUrl };
}

export function getPayPalDonateUrl(description: string): string {
  const params = new URLSearchParams({
    business: PAYPAL_EMAIL,
    no_recurring: '0',
    item_name: description,
    currency_code: 'BRL',
  });
  return `https://www.paypal.com/donate/?${params.toString()}`;
}

