'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';

export default function ShareQr({ value }: { value: string }) {
  const [image, setImage] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!value) return;
    void QRCode.toDataURL(value, { width: 180, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#07131b', light: '#e8faff' } })
      .then(result => { if (!cancelled) setImage(result); })
      .catch(() => { if (!cancelled) setImage(''); });
    return () => { cancelled = true; };
  }, [value]);
  if (!image) return null;
  return <div className="share-qr"><Image src={image} width={120} height={120} unoptimized alt="QR-Code zum Öffnen der Nachricht" /><p>Scannen und direkt öffnen</p></div>;
}
