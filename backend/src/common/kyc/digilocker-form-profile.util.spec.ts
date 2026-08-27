import { extractProfileFromDigilockerFormJson, pickDigilockerAadhaarString } from './digilocker-form-profile.util';

describe('digilocker-form-profile.util', () => {
  it('reads flattened Surepass fields', () => {
    const profile = extractProfileFromDigilockerFormJson({
      full_name: 'Rahul Kumar',
      dob: '1995-05-15',
      masked_aadhaar: 'XXXXXXXX1234',
    });
    expect(profile.fullName).toBe('Rahul Kumar');
    expect(profile.dateOfBirth?.getFullYear()).toBe(1995);
    expect(profile.dateOfBirth?.getMonth()).toBe(4);
    expect(profile.dateOfBirth?.getDate()).toBe(15);
    expect(pickDigilockerAadhaarString({ masked_aadhaar: 'XXXXXXXX1234' }, ['maskedAadhaar', 'masked_aadhaar'])).toBe(
      'XXXXXXXX1234',
    );
  });

  it('reads nested aadhaar_xml_data when DigiLocker payload was not flattened', () => {
    const profile = extractProfileFromDigilockerFormJson({
      client_id: 'digilocker_abc',
      aadhaar_xml_data: {
        full_name: 'Rahul Kumar',
        dob: '15-05-1995',
        masked_aadhaar: 'XXXXXXXX1234',
        gender: 'M',
      },
    });
    expect(profile.fullName).toBe('Rahul Kumar');
    expect(profile.dateOfBirth?.getFullYear()).toBe(1995);
    expect(
      pickDigilockerAadhaarString(
        { aadhaar_xml_data: { masked_aadhaar: 'XXXXXXXX1234' } },
        ['maskedAadhaar', 'masked_aadhaar'],
      ),
    ).toBe('XXXXXXXX1234');
  });
});
