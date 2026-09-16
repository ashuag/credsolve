import { extractProfileFromDigilockerFormJson, pickDigilockerAadhaarString } from './digilocker-form-profile.util';

describe('digilocker-form-profile.util', () => {
  it('reads flattened Surepass fields', () => {
    const profile = extractProfileFromDigilockerFormJson({
      full_name: 'Rahul Kumar',
      dob: '1995-05-15',
      masked_aadhaar: 'XXXXXXXX1234',
    });
    expect(profile.fullName).toBe('Rahul Kumar');
    expect(profile.dateOfBirth?.getUTCFullYear()).toBe(1995);
    expect(profile.dateOfBirth?.getUTCMonth()).toBe(4);
    expect(profile.dateOfBirth?.getUTCDate()).toBe(15);
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
    expect(profile.dateOfBirth?.getUTCFullYear()).toBe(1995);
    expect(
      pickDigilockerAadhaarString(
        { aadhaar_xml_data: { masked_aadhaar: 'XXXXXXXX1234' } },
        ['maskedAadhaar', 'masked_aadhaar'],
      ),
    ).toBe('XXXXXXXX1234');
    expect(profile.gender).toBe('M');
  });

  it('reads Surepass maskedaadhaar and nested address bags', () => {
    const form = {
      name: 'SANTHI FRANCIS',
      dob: '08-05-1981',
      gender: 'F',
      maskedaadhaar: 'xxxxxxxx4351',
      address: {
        house: '3/61',
        loc: 'Udumalai Road Pollachi',
        locality: 'Min Nagar',
        vtc: 'Makkinampatti',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        pin: '642003',
      },
    };
    const profile = extractProfileFromDigilockerFormJson(form);
    expect(profile.fullName).toBe('SANTHI FRANCIS');
    expect(profile.dateOfBirth?.toISOString().slice(0, 10)).toBe('1981-05-08');
    expect(profile.gender).toBe('F');
    expect(pickDigilockerAadhaarString(form, ['maskedAadhaar', 'masked_aadhaar', 'maskedaadhaar'])).toBe(
      'xxxxxxxx4351',
    );
    expect(pickDigilockerAadhaarString(form, ['house'])).toBe('3/61');
    expect(pickDigilockerAadhaarString(form, ['loc'])).toBe('Udumalai Road Pollachi');
  });
});
