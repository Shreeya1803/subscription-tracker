/** Currencies offered in the app's pickers (ISO 4217 codes, which the database requires). */
export type CurrencyOption = { code: string; name: string; flag: string; regions: string[] };

export const CURRENCIES: CurrencyOption[] = [
  { code: 'AUD', name: 'Australian dollar', flag: '🇦🇺', regions: ['AU'] },
  { code: 'INR', name: 'Indian rupee', flag: '🇮🇳', regions: ['IN'] },
  { code: 'USD', name: 'US dollar', flag: '🇺🇸', regions: ['US', 'EC', 'SV', 'PR'] },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺', regions: ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'GR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY', 'HR'] },
  { code: 'GBP', name: 'British pound', flag: '🇬🇧', regions: ['GB'] },
  { code: 'NZD', name: 'New Zealand dollar', flag: '🇳🇿', regions: ['NZ'] },
  { code: 'CAD', name: 'Canadian dollar', flag: '🇨🇦', regions: ['CA'] },
  { code: 'SGD', name: 'Singapore dollar', flag: '🇸🇬', regions: ['SG'] },
  { code: 'AED', name: 'UAE dirham', flag: '🇦🇪', regions: ['AE'] },
  { code: 'SAR', name: 'Saudi riyal', flag: '🇸🇦', regions: ['SA'] },
  { code: 'QAR', name: 'Qatari riyal', flag: '🇶🇦', regions: ['QA'] },
  { code: 'JPY', name: 'Japanese yen', flag: '🇯🇵', regions: ['JP'] },
  { code: 'CNY', name: 'Chinese yuan', flag: '🇨🇳', regions: ['CN'] },
  { code: 'HKD', name: 'Hong Kong dollar', flag: '🇭🇰', regions: ['HK'] },
  { code: 'KRW', name: 'South Korean won', flag: '🇰🇷', regions: ['KR'] },
  { code: 'MYR', name: 'Malaysian ringgit', flag: '🇲🇾', regions: ['MY'] },
  { code: 'IDR', name: 'Indonesian rupiah', flag: '🇮🇩', regions: ['ID'] },
  { code: 'THB', name: 'Thai baht', flag: '🇹🇭', regions: ['TH'] },
  { code: 'PHP', name: 'Philippine peso', flag: '🇵🇭', regions: ['PH'] },
  { code: 'VND', name: 'Vietnamese dong', flag: '🇻🇳', regions: ['VN'] },
  { code: 'PKR', name: 'Pakistani rupee', flag: '🇵🇰', regions: ['PK'] },
  { code: 'BDT', name: 'Bangladeshi taka', flag: '🇧🇩', regions: ['BD'] },
  { code: 'LKR', name: 'Sri Lankan rupee', flag: '🇱🇰', regions: ['LK'] },
  { code: 'NPR', name: 'Nepalese rupee', flag: '🇳🇵', regions: ['NP'] },
  { code: 'CHF', name: 'Swiss franc', flag: '🇨🇭', regions: ['CH', 'LI'] },
  { code: 'SEK', name: 'Swedish krona', flag: '🇸🇪', regions: ['SE'] },
  { code: 'NOK', name: 'Norwegian krone', flag: '🇳🇴', regions: ['NO'] },
  { code: 'DKK', name: 'Danish krone', flag: '🇩🇰', regions: ['DK'] },
  { code: 'PLN', name: 'Polish złoty', flag: '🇵🇱', regions: ['PL'] },
  { code: 'ZAR', name: 'South African rand', flag: '🇿🇦', regions: ['ZA'] },
  { code: 'NGN', name: 'Nigerian naira', flag: '🇳🇬', regions: ['NG'] },
  { code: 'KES', name: 'Kenyan shilling', flag: '🇰🇪', regions: ['KE'] },
  { code: 'EGP', name: 'Egyptian pound', flag: '🇪🇬', regions: ['EG'] },
  { code: 'TRY', name: 'Turkish lira', flag: '🇹🇷', regions: ['TR'] },
  { code: 'BRL', name: 'Brazilian real', flag: '🇧🇷', regions: ['BR'] },
  { code: 'MXN', name: 'Mexican peso', flag: '🇲🇽', regions: ['MX'] },
];

export function findCurrency(code: string | undefined | null) {
  return CURRENCIES.find((c) => c.code === code?.toUpperCase());
}

/** Best guess from the phone's region (e.g. en-AU -> AUD). Falls back to USD. */
export function guessCurrency(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const region = locale.split(/[-_]/).find((part, i) => i > 0 && /^[A-Z]{2}$/.test(part));
    const match = region ? CURRENCIES.find((c) => c.regions.includes(region)) : undefined;
    return match?.code ?? 'USD';
  } catch {
    return 'USD';
  }
}
