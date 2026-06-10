import forge from 'node-forge';

export type PfxCertificateMetadata = {
  serialNumber: string;
  commonName: string | null;
};

export function readPfxCertificateMetadata(pfxBuffer: Buffer, passphrase: string): PfxCertificateMetadata {
  const forgeCert = forge.util.createBuffer(pfxBuffer.toString('binary'));
  const p12Asn1 = forge.asn1.fromDer(forgeCert);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  if (!certBags?.length) {
    throw new Error('No certificate found in PFX file.');
  }

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
    forge.pki.oids.pkcs8ShroudedKeyBag
  ];
  const privateKey = keyBags?.[0]?.key;
  if (!privateKey) {
    throw new Error('No private key found in PFX file.');
  }

  let certificate = certBags[0].cert!;
  for (const bag of certBags) {
    const cert = bag.cert;
    if (!cert) continue;
    if (privateKey.n.compareTo(cert.publicKey.n) === 0 && privateKey.e.compareTo(cert.publicKey.e) === 0) {
      certificate = cert;
      break;
    }
  }

  const cn = certificate.subject.getField('CN')?.value;
  return {
    serialNumber: certificate.serialNumber,
    commonName: typeof cn === 'string' ? cn : cn != null ? String(cn) : null,
  };
}
