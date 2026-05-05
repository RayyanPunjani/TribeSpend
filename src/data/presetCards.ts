// Static preset card reward database — not stored in DB, used for auto-filling CardManager forms
import type { CardRewardRule, CardCredit } from '@/types'

export interface PresetReward {
  category: string       // TribeSpend taxonomy category, or 'base' for the default rate
  merchantKeywords?: string[]
  rate: number           // decimal for cashback (0.03), multiplier for points (3)
  isRotating?: boolean
  cap?: string           // display-only, e.g. "$6,000/year"
  notes?: string
}

export interface PresetCredit {
  name: string
  amount: number         // total amount per period (not monthly equivalent)
  frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual'
  creditType: 'statement' | 'portal' | 'in-app'
  merchantMatch?: string // uppercase keyword matched against transaction descriptions (statement only)
  notes?: string
}

export interface PresetCardTemplate {
  issuer: string         // actual issuing bank (e.g., "American Express")
  brand?: string         // display brand for dropdown (e.g., "Delta") — defaults to issuer
  cardName: string       // human-readable card name shown in step-2 dropdown
  cardType: string       // matches CreditCard.cardType field
  annualFee: number
  rewardType: 'cashback' | 'points'
  group?: 'banks' | 'airlines' | 'hotels' | 'fintech'
  rewards: PresetReward[]
  credits?: PresetCredit[]
}

export const PRESET_CARDS: PresetCardTemplate[] = [
  // ── Chase (Banks) ─────────────────────────────────────────────────────────────
  {
    issuer: 'Chase', cardName: 'Sapphire Preferred', cardType: 'Sapphire Preferred',
    annualFee: 95, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'Travel',        rate: 2, notes: '5x via Chase Travel portal' },
      { category: 'Dining',        rate: 3 },
      { category: 'Subscriptions', rate: 3, notes: 'Streaming services' },
      { category: 'Groceries',     rate: 3, notes: 'Online grocery purchases only' },
      { category: 'base',          rate: 1 },
    ],
  },
  {
    issuer: 'Chase', cardName: 'Sapphire Reserve', cardType: 'Sapphire Reserve',
    annualFee: 795, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'Travel',  rate: 3, notes: '10x hotels/cars & 5x flights via Chase Travel portal' },
      { category: 'Dining',  rate: 3 },
      { category: 'base',    rate: 1 },
    ],
    credits: [
      { name: 'Travel Credit', amount: 300, frequency: 'annual', creditType: 'statement', notes: 'Applied automatically to travel purchases' },
    ],
  },
  {
    issuer: 'Chase', cardName: 'Freedom Unlimited', cardType: 'Freedom Unlimited',
    annualFee: 0, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'Dining',           rate: 3 },
      { category: 'Health & Medical', rate: 3, notes: 'Drugstore purchases' },
      { category: 'base',             rate: 1.5 },
    ],
  },
  {
    issuer: 'Chase', cardName: 'Freedom Flex', cardType: 'Freedom Flex',
    annualFee: 0, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'Shopping',         rate: 5, isRotating: true, cap: '$1,500/quarter', notes: 'Rotating quarterly category' },
      { category: 'Dining',           rate: 3 },
      { category: 'Health & Medical', rate: 3, notes: 'Drugstore purchases' },
      { category: 'base',             rate: 1 },
    ],
  },
  {
    issuer: 'Chase', cardName: 'Ink Business Preferred', cardType: 'Ink Business Preferred',
    annualFee: 95, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'Travel',        rate: 3 },
      { category: 'Subscriptions', rate: 3, notes: 'Internet, cable, and phone services', cap: '$150,000/yr combined' },
      { category: 'Shopping',      rate: 3, notes: 'Shipping and advertising purchases', cap: '$150,000/yr combined' },
      { category: 'base',          rate: 1 },
    ],
  },
  {
    issuer: 'Chase', brand: 'Amazon', cardName: 'Amazon Prime Visa', cardType: 'Amazon Prime Visa',
    annualFee: 0, rewardType: 'cashback', group: 'fintech',
    rewards: [
      { category: 'Shopping',         merchantKeywords: ['AMAZON', 'AMAZON.COM', 'AMZN', 'WHOLE FOODS', 'WHOLEFOODS', 'WHOLEFDS'], rate: 0.05, notes: 'Amazon / Whole Foods only (Prime members)' },
      { category: 'Dining',           rate: 0.02 },
      { category: 'Gas & EV Charging', rate: 0.02 },
      { category: 'Transportation',   rate: 0.02, notes: 'Local transit & rideshare' },
      { category: 'base',             rate: 0.01 },
    ],
  },

  // ── American Express (Banks) ──────────────────────────────────────────────────
  {
    issuer: 'American Express', cardName: 'Gold Card', cardType: 'Gold Card',
    annualFee: 325, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'Dining',    rate: 4 },
      { category: 'Groceries', rate: 4, cap: '$25,000/year at US supermarkets' },
      { category: 'Travel',    rate: 3, notes: 'Flights booked directly with airlines or via Amex Travel' },
      { category: 'base',      rate: 1 },
    ],
    credits: [
      { name: 'Uber Credit',     amount: 10, frequency: 'monthly', creditType: 'in-app',    notes: 'Added directly to Uber Cash balance in the Uber app. Does not appear on card statement.' },
      { name: 'Dining Credit',   amount: 10, frequency: 'monthly', creditType: 'statement', notes: 'Select participating restaurants via Amex Offers, charged to card and credited back' },
      { name: "Dunkin' Credit",  amount: 7,  frequency: 'monthly', creditType: 'statement', merchantMatch: 'DUNKIN', notes: "Statement credit for Dunkin' purchases" },
    ],
  },
  {
    issuer: 'American Express', cardName: 'Platinum Card', cardType: 'Platinum Card',
    annualFee: 695, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'Travel', rate: 5, notes: 'Flights booked directly with airlines or via Amex Travel' },
      { category: 'base',   rate: 1 },
    ],
    credits: [
      { name: 'Airline Fee Credit', amount: 200, frequency: 'annual',  creditType: 'statement', notes: 'Select one airline per calendar year; covers incidental fees like bag fees and seat upgrades' },
      { name: 'Hotel Credit',       amount: 200, frequency: 'annual',  creditType: 'portal',    notes: 'Book through Fine Hotels + Resorts or The Hotel Collection on AmexTravel.com' },
      { name: 'Uber Credit',        amount: 15,  frequency: 'monthly', creditType: 'in-app',    notes: 'Added directly to Uber Cash balance in the Uber app. $20 in December. Does not appear on card statement.' },
      { name: 'Dining Credit',      amount: 20,  frequency: 'monthly', creditType: 'statement', notes: 'Select participating restaurants via Amex Offers' },
    ],
  },
  {
    issuer: 'American Express', cardName: 'Blue Cash Preferred', cardType: 'Blue Cash Preferred',
    annualFee: 95, rewardType: 'cashback', group: 'banks',
    rewards: [
      { category: 'Groceries',         rate: 0.06, cap: '$6,000/year at US supermarkets' },
      { category: 'Subscriptions',     rate: 0.06, notes: 'Streaming subscriptions' },
      { category: 'Gas & EV Charging', rate: 0.03 },
      { category: 'Transportation',    rate: 0.03, notes: 'Transit including taxis, rideshare, trains, buses' },
      { category: 'base',              rate: 0.01 },
    ],
  },
  {
    issuer: 'American Express', cardName: 'Blue Cash Everyday', cardType: 'Blue Cash Everyday',
    annualFee: 0, rewardType: 'cashback', group: 'banks',
    rewards: [
      { category: 'Groceries',         rate: 0.03, cap: '$6,000/year at US supermarkets' },
      { category: 'Gas & EV Charging', rate: 0.03 },
      { category: 'Shopping',          rate: 0.03, notes: 'US online retail purchases' },
      { category: 'base',              rate: 0.01 },
    ],
  },

  // ── Capital One (Banks) ───────────────────────────────────────────────────────
  {
    issuer: 'Capital One', cardName: 'Venture X', cardType: 'Venture X',
    annualFee: 395, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'base', rate: 2, notes: 'Earn 10x hotels & rental cars, 5x flights when booking through Capital One Travel portal' },
    ],
    credits: [
      { name: 'Travel Credit', amount: 300, frequency: 'annual', creditType: 'portal', notes: 'Book through Capital One Travel portal' },
    ],
  },
  {
    issuer: 'Capital One', cardName: 'Venture Rewards', cardType: 'Venture Rewards',
    annualFee: 95, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'base', rate: 2, notes: 'Earn 5x hotels & rental cars when booking through Capital One Travel portal' },
    ],
  },
  {
    issuer: 'Capital One', cardName: 'Savor', cardType: 'Savor',
    annualFee: 0, rewardType: 'cashback', group: 'banks',
    rewards: [
      { category: 'Dining',        rate: 0.03 },
      { category: 'Entertainment', rate: 0.03 },
      { category: 'Subscriptions', rate: 0.03, notes: 'Streaming subscriptions' },
      { category: 'Groceries',     rate: 0.03 },
      { category: 'base',          rate: 0.01 },
    ],
  },
  {
    issuer: 'Capital One', cardName: 'SavorOne', cardType: 'SavorOne',
    annualFee: 0, rewardType: 'cashback', group: 'banks',
    rewards: [
      { category: 'Dining',        rate: 0.03 },
      { category: 'Entertainment', rate: 0.03 },
      { category: 'Subscriptions', rate: 0.03, notes: 'Streaming subscriptions' },
      { category: 'Groceries',     rate: 0.03 },
      { category: 'base',          rate: 0.01 },
    ],
  },
  {
    issuer: 'Capital One', cardName: 'Quicksilver', cardType: 'Quicksilver',
    annualFee: 0, rewardType: 'cashback', group: 'banks',
    rewards: [{ category: 'base', rate: 0.015 }],
  },

  // ── Citi (Banks) ──────────────────────────────────────────────────────────────
  {
    issuer: 'Citi', cardName: 'Custom Cash', cardType: 'Custom Cash',
    annualFee: 0, rewardType: 'cashback', group: 'banks',
    rewards: [
      { category: 'Dining', rate: 0.05, cap: '$500/billing cycle', notes: '5% on your highest spend category each cycle' },
      { category: 'base',   rate: 0.01 },
    ],
  },
  {
    issuer: 'Citi', cardName: 'Double Cash', cardType: 'Double Cash',
    annualFee: 0, rewardType: 'cashback', group: 'banks',
    rewards: [{ category: 'base', rate: 0.02 }],
  },
  {
    issuer: 'Citi', cardName: 'Strata Premier', cardType: 'Strata Premier',
    annualFee: 95, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'Travel',            rate: 3 },
      { category: 'Dining',            rate: 3 },
      { category: 'Groceries',         rate: 3 },
      { category: 'Gas & EV Charging', rate: 3 },
      { category: 'base',              rate: 1 },
    ],
  },
  {
    issuer: 'Citi', brand: 'Costco', cardName: 'Costco Anywhere Visa', cardType: 'Costco Anywhere Visa',
    annualFee: 0, rewardType: 'cashback', group: 'fintech',
    rewards: [
      { category: 'Gas & EV Charging', rate: 0.04, cap: '$7,000/year on gas' },
      { category: 'Dining',            rate: 0.03 },
      { category: 'Travel',            rate: 0.03 },
      { category: 'Groceries',         merchantKeywords: ['COSTCO'], rate: 0.02, notes: 'Costco only' },
      { category: 'base',              rate: 0.01 },
    ],
  },

  // ── Discover (Banks) ──────────────────────────────────────────────────────────
  {
    issuer: 'Discover', cardName: 'it Cash Back', cardType: 'it Cash Back',
    annualFee: 0, rewardType: 'cashback', group: 'banks',
    rewards: [
      { category: 'Shopping', rate: 0.05, isRotating: true, cap: '$1,500/quarter', notes: 'Rotating quarterly category' },
      { category: 'base',     rate: 0.01 },
    ],
  },

  // ── Bank of America (Banks) ───────────────────────────────────────────────────
  {
    issuer: 'Bank of America', cardName: 'Customized Cash Rewards', cardType: 'Customized Cash Rewards',
    annualFee: 0, rewardType: 'cashback', group: 'banks',
    rewards: [
      { category: 'Gas & EV Charging', rate: 0.03, notes: '3% on chosen category; 2% at grocery stores & wholesale clubs' },
      { category: 'Groceries',         rate: 0.02 },
      { category: 'base',              rate: 0.01 },
    ],
  },
  {
    issuer: 'Bank of America', cardName: 'Unlimited Cash Rewards', cardType: 'Unlimited Cash Rewards',
    annualFee: 0, rewardType: 'cashback', group: 'banks',
    rewards: [{ category: 'base', rate: 0.015 }],
  },

  // ── Wells Fargo (Banks) ───────────────────────────────────────────────────────
  {
    issuer: 'Wells Fargo', cardName: 'Active Cash', cardType: 'Active Cash',
    annualFee: 0, rewardType: 'cashback', group: 'banks',
    rewards: [{ category: 'base', rate: 0.02 }],
  },
  {
    issuer: 'Wells Fargo', cardName: 'Autograph', cardType: 'Autograph',
    annualFee: 0, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'Dining',            rate: 3 },
      { category: 'Travel',            rate: 3 },
      { category: 'Gas & EV Charging', rate: 3 },
      { category: 'Transportation',    rate: 3 },
      { category: 'Subscriptions',     rate: 3, notes: 'Streaming services' },
      { category: 'base',              rate: 1 },
    ],
  },

  // ── US Bank (Banks) ───────────────────────────────────────────────────────────
  {
    issuer: 'US Bank', cardName: 'Altitude Go', cardType: 'Altitude Go',
    annualFee: 0, rewardType: 'points', group: 'banks',
    rewards: [
      { category: 'Dining',            rate: 4 },
      { category: 'Groceries',         rate: 2 },
      { category: 'Subscriptions',     rate: 2, notes: 'Streaming services' },
      { category: 'Gas & EV Charging', rate: 2 },
      { category: 'base',              rate: 1 },
    ],
  },

  // ── Delta / American Express (Airlines) ───────────────────────────────────────
  {
    issuer: 'American Express', brand: 'Delta', cardName: 'Delta SkyMiles Gold', cardType: 'Delta SkyMiles Gold',
    annualFee: 150, rewardType: 'points', group: 'airlines',
    rewards: [
      { category: 'Travel',    rate: 2, notes: 'Delta purchases' },
      { category: 'Dining',    rate: 2 },
      { category: 'Groceries', rate: 2 },
      { category: 'base',      rate: 1 },
    ],
  },
  {
    issuer: 'American Express', brand: 'Delta', cardName: 'Delta SkyMiles Platinum', cardType: 'Delta SkyMiles Platinum',
    annualFee: 350, rewardType: 'points', group: 'airlines',
    rewards: [
      { category: 'Travel',    rate: 3, notes: 'Delta purchases' },
      { category: 'Dining',    rate: 2 },
      { category: 'Groceries', rate: 2 },
      { category: 'base',      rate: 1 },
    ],
  },

  // ── United / Chase (Airlines) ─────────────────────────────────────────────────
  {
    issuer: 'Chase', brand: 'United', cardName: 'United Explorer', cardType: 'United Explorer',
    annualFee: 95, rewardType: 'points', group: 'airlines',
    rewards: [
      { category: 'Travel',  rate: 2, notes: 'United purchases and hotels' },
      { category: 'Dining',  rate: 2 },
      { category: 'base',    rate: 1 },
    ],
  },

  // ── Southwest / Chase (Airlines) ──────────────────────────────────────────────
  {
    issuer: 'Chase', brand: 'Southwest', cardName: 'Southwest Rapid Rewards Plus', cardType: 'Southwest Rapid Rewards Plus',
    annualFee: 69, rewardType: 'points', group: 'airlines',
    rewards: [
      { category: 'Travel',  rate: 2, notes: 'Southwest purchases and hotels' },
      { category: 'Dining',  rate: 2 },
      { category: 'base',    rate: 1 },
    ],
  },
  {
    issuer: 'Chase', brand: 'Southwest', cardName: 'Southwest Rapid Rewards Priority', cardType: 'Southwest Rapid Rewards Priority',
    annualFee: 149, rewardType: 'points', group: 'airlines',
    rewards: [
      { category: 'Travel',  rate: 2, notes: 'Southwest purchases and hotels' },
      { category: 'Dining',  rate: 2 },
      { category: 'base',    rate: 1 },
    ],
    credits: [
      { name: 'Southwest Credit', amount: 75, frequency: 'annual', creditType: 'statement', notes: 'Applied to Southwest purchases' },
    ],
  },

  // ── JetBlue (Airlines) ────────────────────────────────────────────────────────
  {
    issuer: 'JetBlue', brand: 'JetBlue', cardName: 'JetBlue Plus', cardType: 'JetBlue Plus',
    annualFee: 99, rewardType: 'points', group: 'airlines',
    rewards: [
      { category: 'Travel',    rate: 6, notes: 'JetBlue purchases' },
      { category: 'Dining',    rate: 2 },
      { category: 'Groceries', rate: 2 },
      { category: 'base',      rate: 1 },
    ],
  },

  // ── American Airlines / Citi (Airlines) ──────────────────────────────────────
  {
    issuer: 'Citi', brand: 'American Airlines', cardName: 'AAdvantage Platinum Select', cardType: 'AAdvantage Platinum Select',
    annualFee: 99, rewardType: 'points', group: 'airlines',
    rewards: [
      { category: 'Travel',            rate: 2, notes: 'American Airlines purchases' },
      { category: 'Dining',            rate: 2 },
      { category: 'Gas & EV Charging', rate: 2 },
      { category: 'base',              rate: 1 },
    ],
  },

  // ── Alaska/Hawaiian (Atmos) / Bank of America (Airlines) ─────────────────────
  {
    issuer: 'Bank of America', brand: 'Alaska/Hawaiian (Atmos)', cardName: 'Atmos Rewards Ascent', cardType: 'Atmos Rewards Ascent',
    annualFee: 95, rewardType: 'points', group: 'airlines',
    rewards: [
      { category: 'Travel',            rate: 3, notes: 'Alaska Airlines + Hawaiian Airlines purchases' },
      { category: 'Gas & EV Charging', rate: 2 },
      { category: 'Subscriptions',     rate: 2, notes: 'Cable, streaming, and satellite' },
      { category: 'Transportation',    rate: 2, notes: 'Local transit, rideshare, and tolls' },
      { category: 'base',              rate: 1 },
    ],
  },
  {
    issuer: 'Bank of America', brand: 'Alaska/Hawaiian (Atmos)', cardName: 'Atmos Rewards Summit', cardType: 'Atmos Rewards Summit',
    annualFee: 395, rewardType: 'points', group: 'airlines',
    rewards: [
      { category: 'Dining',  rate: 3 },
      { category: 'Travel',  rate: 3, notes: 'Alaska/Hawaiian + foreign transactions' },
      { category: 'base',    rate: 1 },
    ],
    credits: [
      { name: 'Flight Delay Voucher', amount: 50, frequency: 'annual', creditType: 'portal', notes: '$50 flight delay voucher via Alaska/Hawaiian portal' },
    ],
  },

  // ── Hilton / American Express (Hotels) ───────────────────────────────────────
  {
    issuer: 'American Express', brand: 'Hilton', cardName: 'Hilton Honors', cardType: 'Hilton Honors',
    annualFee: 0, rewardType: 'points', group: 'hotels',
    rewards: [
      { category: 'Travel',            rate: 7, notes: 'Hilton properties' },
      { category: 'Dining',            rate: 5 },
      { category: 'Groceries',         rate: 5 },
      { category: 'Gas & EV Charging', rate: 3 },
      { category: 'base',              rate: 3 },
    ],
  },

  // ── Marriott / American Express (Hotels) ─────────────────────────────────────
  {
    issuer: 'American Express', brand: 'Marriott', cardName: 'Marriott Bonvoy', cardType: 'Marriott Bonvoy',
    annualFee: 125, rewardType: 'points', group: 'hotels',
    rewards: [
      { category: 'Travel',    rate: 6, notes: 'Marriott Bonvoy properties' },
      { category: 'Dining',    rate: 4 },
      { category: 'Groceries', rate: 4 },
      { category: 'base',      rate: 2 },
    ],
  },

  // ── Hyatt / Chase (Hotels) ────────────────────────────────────────────────────
  {
    issuer: 'Chase', brand: 'Hyatt', cardName: 'World of Hyatt', cardType: 'World of Hyatt',
    annualFee: 95, rewardType: 'points', group: 'hotels',
    rewards: [
      { category: 'Travel',         rate: 4, notes: 'Hyatt properties' },
      { category: 'Dining',         rate: 2 },
      { category: 'Transportation', rate: 2, notes: 'Local transit & rideshare' },
      { category: 'base',           rate: 1 },
    ],
  },

  // ── IHG / Chase (Hotels) ──────────────────────────────────────────────────────
  {
    issuer: 'Chase', brand: 'IHG', cardName: 'IHG One Rewards Premier', cardType: 'IHG One Rewards Premier',
    annualFee: 99, rewardType: 'points', group: 'hotels',
    rewards: [
      { category: 'Travel',            rate: 10, notes: 'IHG Hotels & Resorts properties' },
      { category: 'Dining',            rate: 2 },
      { category: 'Gas & EV Charging', rate: 2 },
      { category: 'Groceries',         rate: 2 },
      { category: 'base',              rate: 1 },
    ],
  },

  // ── Wyndham / Barclays (Hotels) ───────────────────────────────────────────────
  {
    issuer: 'Barclays', brand: 'Wyndham', cardName: 'Wyndham Rewards Earner Plus', cardType: 'Wyndham Rewards Earner Plus',
    annualFee: 75, rewardType: 'points', group: 'hotels',
    rewards: [
      { category: 'Travel',    rate: 6, notes: 'Wyndham Hotels & Resorts properties' },
      { category: 'Dining',    rate: 4 },
      { category: 'Groceries', rate: 4 },
      { category: 'base',      rate: 1 },
    ],
  },

  // ── Robinhood (Fintech) ───────────────────────────────────────────────────────
  {
    issuer: 'Robinhood', brand: 'Robinhood', cardName: 'Robinhood Gold Card', cardType: 'Robinhood Gold Card',
    annualFee: 0, rewardType: 'cashback', group: 'fintech',
    rewards: [
      { category: 'base', rate: 0.03, notes: 'Flat 3% on all purchases; requires Robinhood Gold subscription ($5/mo or $50/yr)' },
    ],
  },

  // ── Apple (Fintech) ───────────────────────────────────────────────────────────
  {
    issuer: 'Apple', brand: 'Apple', cardName: 'Apple Card', cardType: 'Apple Card',
    annualFee: 0, rewardType: 'cashback', group: 'fintech',
    rewards: [
      { category: 'Shopping', merchantKeywords: ['APPLE', 'APPLE.COM', 'APP STORE', 'ICLOUD'], rate: 0.03, notes: 'Apple purchases only' },
      { category: 'base',     rate: 0.02, notes: '2% via Apple Pay; 1% with physical card' },
    ],
  },

  // ── Bilt / Wells Fargo (Fintech) ──────────────────────────────────────────────
  {
    issuer: 'Wells Fargo', brand: 'Bilt', cardName: 'Bilt Blue Card', cardType: 'Bilt Blue Card',
    annualFee: 0, rewardType: 'points', group: 'fintech',
    rewards: [
      { category: 'base', rate: 1, notes: 'Earn on rent/mortgage too (up to 1.25x based on spend level)' },
    ],
  },
  {
    issuer: 'Wells Fargo', brand: 'Bilt', cardName: 'Bilt Obsidian Card', cardType: 'Bilt Obsidian Card',
    annualFee: 95, rewardType: 'points', group: 'fintech',
    rewards: [
      { category: 'Dining',    rate: 3, notes: 'Choose Dining OR Groceries for 3x (not both)' },
      { category: 'Groceries', rate: 3, notes: 'Choose Dining OR Groceries for 3x (not both)' },
      { category: 'Travel',    rate: 2 },
      { category: 'base',      rate: 1, notes: 'Earns 1x on rent/mortgage' },
    ],
    credits: [
      { name: 'Hotel Credit', amount: 50, frequency: 'semi-annual', creditType: 'portal', notes: 'Bilt Travel Portal, 2-night minimum stay' },
    ],
  },
  {
    issuer: 'Wells Fargo', brand: 'Bilt', cardName: 'Bilt Palladium Card', cardType: 'Bilt Palladium Card',
    annualFee: 495, rewardType: 'points', group: 'fintech',
    rewards: [
      { category: 'Dining',    rate: 3, notes: 'Choose Dining OR Groceries for 3x (not both)' },
      { category: 'Groceries', rate: 3, notes: 'Choose Dining OR Groceries for 3x (not both)' },
      { category: 'base',      rate: 2, notes: '2x on all purchases; 1x on rent/mortgage' },
    ],
  },

  // ── Target / TD Bank (Fintech) ────────────────────────────────────────────────
  {
    issuer: 'TD Bank', brand: 'Target', cardName: 'Target RedCard', cardType: 'Target RedCard',
    annualFee: 0, rewardType: 'cashback', group: 'fintech',
    rewards: [
      { category: 'Shopping', merchantKeywords: ['TARGET'], rate: 0.05, notes: 'Target only (applied as savings, not traditional rewards)' },
      { category: 'base',     rate: 0.01 },
    ],
  },
]

// ── Derived lookups ──────────────────────────────────────────────────────────────

/** Returns the display brand for a preset (brand field if set, otherwise issuer). */
export function getPresetBrand(p: PresetCardTemplate): string {
  return p.brand ?? p.issuer
}

/** Presets grouped by display brand for the card selection dropdown. */
export const PRESETS_BY_BRAND: Record<string, PresetCardTemplate[]> = {}
for (const card of PRESET_CARDS) {
  const brand = getPresetBrand(card)
  if (!PRESETS_BY_BRAND[brand]) PRESETS_BY_BRAND[brand] = []
  PRESETS_BY_BRAND[brand].push(card)
}

/** Brands grouped by product group for the brand dropdown optgroups. */
export const BRANDS_BY_GROUP: Record<'banks' | 'airlines' | 'hotels' | 'fintech', string[]> = {
  banks: [], airlines: [], hotels: [], fintech: [],
}
const _seenBrands = new Set<string>()
for (const card of PRESET_CARDS) {
  const brand = getPresetBrand(card)
  const group = card.group ?? 'banks'
  if (!_seenBrands.has(brand)) {
    _seenBrands.add(brand)
    BRANDS_BY_GROUP[group].push(brand)
  }
}

/**
 * Given a Plaid institution name, guess which preset brand to pre-select.
 * Returns '' if no match.
 */
export function guessPresetBrand(institutionName: string | null): string {
  if (!institutionName) return ''
  const n = institutionName.toLowerCase()
  if (n.includes('chase'))                                return 'Chase'
  if (n.includes('american express') || n.includes('amex')) return 'American Express'
  if (n.includes('capital one'))                          return 'Capital One'
  if (n.includes('citi') || n.includes('citibank'))       return 'Citi'
  if (n.includes('discover'))                             return 'Discover'
  if (n.includes('bank of america') || n.includes('bofa')) return 'Bank of America'
  if (n.includes('wells fargo'))                          return 'Wells Fargo'
  if (n.includes('us bank') || n.includes('usbank'))      return 'US Bank'
  if (n.includes('barclays'))                             return 'Barclays'
  if (n.includes('td bank') || n.includes('toronto'))     return 'TD Bank'
  if (n.includes('delta'))                                return 'Delta'
  if (n.includes('united'))                               return 'United'
  if (n.includes('southwest'))                            return 'Southwest'
  if (n.includes('jetblue'))                              return 'JetBlue'
  if (n.includes('american airlines'))                    return 'American Airlines'
  if (n.includes('alaska') || n.includes('hawaiian') || n.includes('atmos')) return 'Alaska/Hawaiian (Atmos)'
  if (n.includes('robinhood'))                            return 'Robinhood'
  if (n.includes('apple'))                                return 'Apple'
  if (n.includes('bilt'))                                 return 'Bilt'
  if (n.includes('amazon'))                               return 'Amazon'
  if (n.includes('target'))                               return 'Target'
  if (n.includes('costco'))                               return 'Costco'
  return ''
}

/**
 * Build CardRewardRule and CardCredit payloads from a preset template.
 * Used by CardManager and PlaidManager when applying a preset on card save.
 */
export function buildRulesFromPreset(
  template: PresetCardTemplate,
  cardId: string,
): {
  rules: Omit<CardRewardRule, 'id'>[]
  credits: Omit<CardCredit, 'id'>[]
} {
  const rules: Omit<CardRewardRule, 'id'>[] = template.rewards.map((reward) => ({
    cardId,
    category: reward.category,
    merchantKeywords: reward.merchantKeywords,
    rewardType: template.rewardType,
    rewardRate: reward.rate,
    isRotating: reward.isRotating,
    notes: [reward.notes, reward.cap ? `Cap: ${reward.cap}` : ''].filter(Boolean).join(' · ') || undefined,
  }))
  const credits: Omit<CardCredit, 'id'>[] = (template.credits ?? []).map((credit) => ({
    cardId,
    name: credit.name,
    amount: credit.amount,
    frequency: credit.frequency,
    creditType: credit.creditType,
    merchantMatch: credit.merchantMatch,
    notes: credit.notes,
  }))
  return { rules, credits }
}

/** @deprecated Use PRESETS_BY_BRAND instead */
export const PRESETS_BY_ISSUER = PRESETS_BY_BRAND

/** Helper to map common bank reward category names → TribeSpend taxonomy */
export function mapRewardCategory(bankCategory: string): string {
  const mapping: Record<string, string> = {
    restaurants:           'Dining',
    dining:                'Dining',
    supermarkets:          'Groceries',
    grocery:               'Groceries',
    groceries:             'Groceries',
    gas:                   'Gas & EV Charging',
    'gas stations':        'Gas & EV Charging',
    'ev charging':         'Gas & EV Charging',
    travel:                'Travel',
    flights:               'Travel',
    hotels:                'Travel',
    airlines:              'Travel',
    streaming:             'Subscriptions',
    'streaming services':  'Subscriptions',
    entertainment:         'Entertainment',
    transit:               'Transportation',
    rideshare:             'Transportation',
    transportation:        'Transportation',
    drugstores:            'Health & Medical',
    pharmacy:              'Health & Medical',
    'online shopping':     'Shopping',
    'online retail':       'Shopping',
    'home improvement':    'Home & Utilities',
    internet:              'Subscriptions',
    phone:                 'Subscriptions',
    'everything else':     'base',
  }
  return mapping[bankCategory.toLowerCase()] ?? bankCategory
}
