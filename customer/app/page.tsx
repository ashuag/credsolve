import type {Metadata} from 'next';
import {HomeChoicePanel} from '@/components/home/home-choice-panel';
import {LoanLandingShell} from '@/components/home/loan-landing-shell';

export const metadata: Metadata = {
    title: 'Get Instant Loan up to ₹50,000',
    description:
        'Choose whether to apply for a MoneyCash loan or log in to an existing journey using the secure OTP flow.',
    openGraph: {
        title: 'Get Instant Loan up to ₹50,000 | MoneyCash',
        description:
            'Choose whether to apply for a MoneyCash loan or log in to an existing journey using the secure OTP flow.',
        type: 'website'
    }
};

export default function CustomerHomePage() {
    return <LoanLandingShell journeyPanel={<HomeChoicePanel/>}/>;
}
