import QRCode from 'qrcode';
import type { QRCodeToBufferOptions } from 'qrcode';

const DEFAULT_OPTIONS: QRCodeToBufferOptions = {
  errorCorrectionLevel: 'M',
  margin: 2,
  width: 256,
  type: 'png',
};

/** Generate a PNG QR code for a URL or other short text payload. */
export async function generateQrCode(
  value: string,
  options: QRCodeToBufferOptions = {},
): Promise<Buffer> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('QR code value must be a non-empty string');
  }

  return QRCode.toBuffer(value, { ...DEFAULT_OPTIONS, ...options, type: 'png' });
}
