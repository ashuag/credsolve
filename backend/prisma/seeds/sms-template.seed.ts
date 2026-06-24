import type { createPrismaClient } from '../prisma-client';

const OTP_PRODUCT = 'OTP';
const TRANSACTIONAL_PRODUCT = 'Transactional';
const LOGIN_OTP_TEMPLATE_ID = '1007367040598516340';
const ESIGN_OTP_TEMPLATE_ID = '1007997896537338264';
const TRANSACTIONAL_TEMPLATE_ID = '1007442260135588994';
const UNDER_REVIEW_TEMPLATE_ID = '1007403812823956210';
const TECHNICAL_ISSUE_MESSAGE_TEMPLATE_ID = '';

const OTP_MESSAGE =
  'Dear Customer, Your MoneyCash login OTP is <OTP>. Enter it to complete sign-in. Valid for 30 seconds. Do not share this code. Regards, MoneyCash';

const TRANSACTIONAL_MESSAGE =
  'Dear Customer, we regret to inform that your loan application with moneycash has not been approved. For further assistance, please contact customer care.';

const UNDER_REVIEW_MESSAGE ='Dear Customer, your loan application requires additional verification. A MoneyCash representative will contact you shortly. Thank you.';

const ESIGN_OTP_MESSAGE =
  'Dear Customer, Your MoneyCash OTP for eSign verification is <OTP>. Valid for 30 seconds. Do not share this code. Regards, MoneyCash';

const SHARED_BEARER_TOKEN = '2|0z2ssTUpIZyvSa06cj3VUzOI6QfynCLMMD6kWGG00b8b179d';

const TECHNICAL_ISSUE_MESSAGE = 'Dear Customer, Thank you for your request. One of our representatives will contact you shortly for additional information. We appreciate your patience. Regards, MoneyCash'

export async function seedSmsTemplate(prisma: ReturnType<typeof createPrismaClient>) {
  await prisma.smsTemplate.upsert({
    where: { templateId: LOGIN_OTP_TEMPLATE_ID },
    create: {
      product: OTP_PRODUCT,
      templateId: LOGIN_OTP_TEMPLATE_ID,
      bearerToken: SHARED_BEARER_TOKEN,
      message: OTP_MESSAGE,
      isActive: true,
    },
    update: {
      product: OTP_PRODUCT,
      bearerToken: SHARED_BEARER_TOKEN,
      message: OTP_MESSAGE,
      isActive: true,
    },
  });

  await prisma.smsTemplate.upsert({
    where: { templateId: TRANSACTIONAL_TEMPLATE_ID },
    create: {
      product: TRANSACTIONAL_PRODUCT,
      templateId: TRANSACTIONAL_TEMPLATE_ID,
      bearerToken: SHARED_BEARER_TOKEN,
      message: TRANSACTIONAL_MESSAGE,
      isActive: true,
    },
    update: {
      product: TRANSACTIONAL_PRODUCT,
      bearerToken: SHARED_BEARER_TOKEN,
      message: TRANSACTIONAL_MESSAGE,
      isActive: true,
    },
  });

  await prisma.smsTemplate.upsert({
    where: { templateId: ESIGN_OTP_TEMPLATE_ID },
    create: {
      product: OTP_PRODUCT,
      templateId: ESIGN_OTP_TEMPLATE_ID,
      bearerToken: SHARED_BEARER_TOKEN,
      message: ESIGN_OTP_MESSAGE,
      isActive: true,
    },
    update: {
      product: OTP_PRODUCT,
      bearerToken: SHARED_BEARER_TOKEN,
      message: ESIGN_OTP_MESSAGE,
      isActive: true,
    },
  });

  await prisma.smsTemplate.upsert({
    where: { templateId: UNDER_REVIEW_TEMPLATE_ID },
    create: {
      product: TRANSACTIONAL_PRODUCT,
      templateId: UNDER_REVIEW_TEMPLATE_ID,
      bearerToken: SHARED_BEARER_TOKEN,
      message: UNDER_REVIEW_MESSAGE,
      isActive: true,
    },
    update: {
      product: TRANSACTIONAL_PRODUCT,
      bearerToken: SHARED_BEARER_TOKEN,
      message: UNDER_REVIEW_MESSAGE,
      isActive: true,
    },
  });


  await prisma.smsTemplate.upsert({
    where: { templateId: TECHNICAL_ISSUE_MESSAGE_TEMPLATE_ID },
    create: {
      product: TRANSACTIONAL_PRODUCT,
      templateId: TECHNICAL_ISSUE_MESSAGE_TEMPLATE_ID,
      bearerToken: SHARED_BEARER_TOKEN,
      message: TECHNICAL_ISSUE_MESSAGE,
      isActive: true,
    },
    update: {
      product: TRANSACTIONAL_PRODUCT,
      bearerToken: SHARED_BEARER_TOKEN,
      message: TECHNICAL_ISSUE_MESSAGE,
      isActive: true,
    },
  });

  console.log('SMS templates seeded');
}
