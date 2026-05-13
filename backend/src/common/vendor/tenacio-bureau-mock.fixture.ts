/**
 * Bureau response used when `BUREAU_FETCH_ENABLED` = `2` (mock mode; no Tenacio HTTP).
 * Shape matches Tenacio soft-pull envelope; `OriginalData` omitted (not required for parsing).
 */
export const TENACIO_BUREAU_MOCK_VENDOR_BODY: Record<string, unknown> = {
  data: {
    htmlUrl:
      'https://myscore.cibil.com/CreditView/webtokenasset.page?enterprise=MEGHDOOT&pcc=AQTPA4652R&webtoken=NPG-f-NxPUSSlHq0RSqeQn-TRIHw026NXaHKBHgKj7qrWXB91m8KMlPLFW6eoFYbcFDWQkUlnLe3FI9bW2XRIg',
    cibilData: {
      GetCustomerAssetsResponse: {
        ResponseKey: '21011d4d277d7bf3:-d791b18:19e210249c1:-6343',
        ResponseStatus: 'Success',
        GetCustomerAssetsSuccess: {
          Asset: {
            Type: 'SingleCreditReport',
            Status: 'Active',
            AssetId: '28036129929',
            CreationDate: '2026-05-13T16:40:13.443+05:30',
            ExpirationDate: '2028-05-12T16:40:13.443+05:30',
            SafetyCheckFailure: false,
            TrueLinkCreditReport: {
              Frozen: '',
              Message: {
                Code: { rank: '100000', symbol: '', description: '', abbreviation: '' },
                Type: { rank: '100000', symbol: 'ZZ', description: '', abbreviation: '' },
                text: '',
              },
              Sources: {
                Source: {
                  Bureau: { rank: '100000', symbol: 'CIBIL', description: '', abbreviation: '' },
                  InquiryDate: '2026-05-13T16:36:17.000+05:30',
                  OriginalData: '',
                },
              },
              Borrower: {
                Birth: {
                  age: '0',
                  date: '1986-08-01+05:30',
                  BirthDate: { day: '1', year: '1986', month: '8' },
                  partitionSet: '0',
                },
                Gender: 'Male',
                CreditScore: {
                  riskScore: '789',
                  scoreName: 'CIBILTransUnionScore3',
                  populationRank: '10',
                  CreditScoreModel: {
                    rank: '100000',
                    symbol: 'CIBILTUSC3',
                    description: '',
                    abbreviation: '',
                  },
                  NoScoreReason: {
                    rank: '100000',
                    symbol: '',
                    description: '',
                    abbreviation: '',
                  },
                },
                borrowerKey: '531337345',
                BorrowerName: {
                  Name: { Forename: 'SAURABH AGARWAL AGARWAL' },
                  partitionSet: '0',
                },
              },
              ReferenceKey: '10983109064',
              FraudIndicator: false,
              currentversion: '5.0',
              DeceasedIndicator: false,
              SafetyCheckPassed: true,
            },
          },
          CreditSummaryData: {
            Inquires: '3',
            CreditMix: '0',
            OnTimePaymentHistory: '100',
            CreditCardUtilization: '14.12',
            OldestCreditAccountPeriod: '169',
          },
        },
      },
    },
  },
  type: 'point',
  status: 'success',
  requestId: 'e81f81cf-26ba-4607-900d-077c703b714d',
  vendorResponse: [{ name: 'SapphireSwan', sequence: 1, statusCode: 200 }],
  serviceStatusCode: 200,
};
