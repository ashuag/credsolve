import {
  extractPanXmlFileIdFromListDocuments,
  mapSurepassDigilockerAadhaarToFormEnvelope,
  mapSurepassDigilockerInitToSessionFields,
  parseDigilockerPanCertificateXml,
} from './surepass-digilocker.mapper';

describe('surepass-digilocker.mapper', () => {
  it('maps initialize response to client_id + url', () => {
    const fields = mapSurepassDigilockerInitToSessionFields({
      data: {
        client_id: 'digilocker_abc',
        url: 'https://digilocker-sdk.example/?token=x',
      },
      success: true,
    });
    expect(fields.clientId).toBe('digilocker_abc');
    expect(fields.url).toBe('https://digilocker-sdk.example/?token=x');
  });

  it('flattens aadhaar_xml_data for DigiLocker parsers', () => {
    const mapped = mapSurepassDigilockerAadhaarToFormEnvelope({
      success: true,
      data: {
        client_id: 'digilocker_abc',
        aadhaar_xml_data: {
          full_name: 'Rahul Kumar',
          dob: '1995-05-15',
          gender: 'M',
          masked_aadhaar: 'XXXXXXXX1234',
          profile_image: 'aGVsbG8=',
          full_address: 'New Delhi',
        },
      },
    }) as { data: Record<string, unknown> };

    expect(mapped.data.full_name).toBe('Rahul Kumar');
    expect(mapped.data.name).toBe('Rahul Kumar');
    expect(mapped.data.dob).toBe('1995-05-15');
    expect(mapped.data.photo).toBe('aGVsbG8=');
    expect(mapped.data.masked_aadhaar).toBe('XXXXXXXX1234');
  });

  it('parses DigiLocker PAN certificate XML attributes', () => {
    const xml = `<?xml version="1.0"?>
<Certificate number="ABCDE1234F" type="PAN">
  <IssuedTo>
    <Person name="RAHUL KUMAR" dob="15-05-1995" gender="M"/>
  </IssuedTo>
</Certificate>`;
    const pan = parseDigilockerPanCertificateXml(xml);
    expect(pan.panNumber).toBe('ABCDE1234F');
    expect(pan.name).toBe('RAHUL KUMAR');
    expect(pan.dob).toBe('15-05-1995');
    expect(pan.gender).toBe('M');
  });

  it('selects PANCR xml file_id from list-documents (ignores pdf / aadhaar)', () => {
    const fileId = extractPanXmlFileIdFromListDocuments({
      data: {
        documents: [
          {
            file_id: 'digilocker_file_aadhaar_xml',
            doc_type: 'ADHAR',
            file_type: 'xml',
          },
          {
            file_id: 'digilocker_file_pan_pdf',
            doc_type: 'PANCR',
            file_type: 'pdf',
          },
          {
            file_id: 'pan',
            doc_type: 'PANCR',
            file_type: 'xml',
          },
        ],
      },
      success: true,
    });
    expect(fileId).toBe('pan');
  });

  it('returns null when list-documents has no PAN XML', () => {
    expect(
      extractPanXmlFileIdFromListDocuments({
        data: {
          documents: [
            { file_id: 'aadhaar', doc_type: 'ADHAR', file_type: 'xml' },
            { file_id: 'pan', doc_type: 'PANCR', file_type: 'pdf' },
          ],
        },
      }),
    ).toBeNull();
  });
});
