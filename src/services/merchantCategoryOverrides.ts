interface MerchantCategoryOverride {
  category: string
  keywords: string[]
}

export const MERCHANT_CATEGORY_OVERRIDES: MerchantCategoryOverride[] = [
  {
    category: 'Gas & EV Charging',
    keywords: [
      'tesla', 'supercharger', 'supercharging', 'gas station', 'gas pump',
      'fuel', 'shell', 'exxon', 'chevron', 'mobil', 'bp ', 'bp-', 'bp#',
      '7 eleven fuel', '7-eleven fuel', '7eleven fuel', 'sunoco', 'arco',
      'marathon', 'circle k', 'quik trip', 'quicktrip', 'wawa',
      'blink charging', 'chargepoint', 'electrify america', 'ev charge', 'evgo',
      'gas mart', 'varsity energy',
    ],
  },
  {
    category: 'Transfer',
    keywords: ['zelle', 'venmo', 'paypal', 'cash app', 'cashapp'],
  },
  {
    category: 'Dining',
    keywords: [
      'uber eats', 'ubereats', 'doordash', 'door dash', 'grubhub',
      'restaurant', 'cafe', 'coffee', 'starbucks', 'dunkin', 'chipotle',
      'einstein', 'einstein bros', 'einstein bagels', 'giordanos', "giordano's",
      'mcdonald', 'wendy', 'burger king', 'panera', 'chick-fil',
      'pizza', 'burger', 'subway', 'taco bell', 'chicken', 'bbq',
      'bagel', 'waffle house', 'sushi', 'sonic', 'dairy queen',
      'five guys', 'popeye', 'whataburger', 'in-n-out', 'panda express',
      'dominos', 'papa john', 'little caesar', 'cracker barrel',
      'olive garden', 'applebee', 'ihop', 'denny', 'smoothie king',
      'jamba juice', 'cold stone', 'baskin', 'jimmy john', 'jersey mike',
      'potbelly', 'firehouse', 'sweetgreen', 'shake shack', 'habit burger',
      'culver',
    ],
  },
  {
    category: 'Groceries',
    keywords: [
      'whole foods', 'wholefoods', 'kroger', 'walmart grocery',
      'trader joe', 'trader joes', 'aldi', 'publix', 'safeway',
      'grocery', 'h-e-b', 'heb ', 'sprouts', 'food lion',
      'lidl', 'wegmans', 'fresh market', 'giant food', 'harris teeter',
      'meijer', "sam's club", 'bjs wholesale', "bj's wholesale",
      'market basket',
    ],
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'amazon mktpl', 'amazon marketplace', 'amazon.com',
      'amzn', 'target', 'walmart', 'walmart.com', 'best buy', 'bestbuy',
      'apple', 'apple store', 'ebay', 'etsy',
      'nordstrom', 'nike', 'zara', 'hm.com', 'h&m', 'uniqlo',
      'hollister', 'patagonia', 'dollar tree', 'hobby lobby',
      'michaels', 'at home', 'apple store', 'tiktok shop', 'shein',
      'asos', 'wayfair', 'overstock', 'chewy', 'petco', 'petsmart',
      'ikea', 'ross stores', 'ross dress', 'tj maxx', 'tjmaxx',
      'marshalls', 'burlington', 'old navy', 'gap ', 'banana republic',
      'victoria secret', 'bath body', 'sephora', 'ulta', 'fedex',
      'ups ', 'usps', 'g2a ', 'steam games',
    ],
  },
  {
    category: 'Transportation',
    keywords: [
      'uber ', 'uber*trip', 'lyft', 'parking', 'toll', 'tollway',
      'transit', 'metro', 'ntta', 'bus fare', 'zipcar', 'bird scooter',
      'lime ', 'turo ', 'city bike',
    ],
  },
  {
    category: 'Subscriptions',
    keywords: [
      'apple.com/bill', 'netflix', 'spotify', 'audible', 'adobe',
      'hulu', 'disney+', 'disneyplus', 'youtube premium', 'apple one',
      'icloud', 'amazon prime', 'openai', 'chatgpt', 'anthropic',
      'claude.ai', 'microsoft 365', 'google one', 'dropbox',
    ],
  },
  {
    category: 'Travel',
    keywords: [
      'airline', 'delta', 'united airline', 'southwest', 'american air',
      'hotel', 'marriott', 'hilton', 'hyatt', 'airbnb', 'expedia',
      'frontier', 'spirit airline', 'jetblue', 'allegiant',
      'alaska airline', 'westin', 'sheraton', 'holiday inn',
      'hampton inn', 'residence inn', 'courtyard', 'doubletree',
      'vrbo', 'booking.com', 'hotels.com', 'kayak', 'priceline',
      'hertz', 'avis', 'enterprise rent', 'national car', 'amtrak',
      'greyhound',
    ],
  },
  {
    category: 'Health & Medical',
    keywords: [
      'cvs', 'walgreen', 'pharmacy', 'rite aid', 'hospital',
      'medical', 'dental', 'doctor', 'clinic', 'optometrist',
      'urgent care', 'pediatric', 'dermatolog', 'orthopedic',
      'cigna', 'aetna', 'blue cross', 'lab corp', 'quest diag',
    ],
  },
  {
    category: 'Insurance',
    keywords: [
      'geico', 'state farm', 'allstate', 'progressive', 'insurance',
      'travelers ins', 'nationwide ins', 'farmers ins', 'farmers insurance', 'liberty mutual',
      'usaa insurance',
    ],
  },
  {
    category: 'Home & Utilities',
    keywords: [
      'electric', 'electricity', 'utility', 'water bill', 'gas bill',
      'natural gas', 'internet', 'xfinity', 'spectrum', 'cox comm',
      'waste mgmt', 'home depot', 'lowes', "lowe's", 'ace hardware',
      'ring alarm', 'ring.com',
    ],
  },
  {
    category: 'Donations & Charity',
    keywords: [
      'masjid', 'mosque', 'islamic center', 'church', 'synagogue',
      'charity', 'donation', 'icna ', 'zeffy', 'zakaat', 'zakat',
      'launchgood', 'gofundme', 'united way', 'red cross', 'salvation army',
    ],
  },
  {
    category: 'Fitness',
    keywords: [
      'planet fitness', 'la fitness', 'equinox', 'gym', 'fitness',
      'crossfit', 'orangetheory', 'anytime fitness', 'ymca',
      "gold's gym", 'crunch fitness', 'lifetime fit',
    ],
  },
  {
    category: 'Personal Care',
    keywords: [
      'barber', 'barbershop', 'salon', 'hair cut', 'hair salon',
      'spa ', 'nail salon', 'great clips', 'supercuts',
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'atom tickets', 'fandango', 'amc theatres', 'regal cinema',
      'cinema', 'movie', 'dave buster', 'bowlero', 'topgolf',
      'main event', 'arcade', 'steam ', 'xbox ', 'playstation',
      'nintendo', 'gamestop', 'twitch', 'theater', 'theatre',
      'escape room', 'escape', 'carnival', 'tickets', 'concert',
    ],
  },
  {
    category: 'Telecom',
    keywords: [
      'at&t wireless', 'verizon wireless', 't-mobile', 'sprint ',
      'us cellular', 'mint mobile', 'cricket wireless', 'boost mobile',
      'metro pcs', 'google fi',
    ],
  },
  {
    category: 'Education',
    keywords: [
      'tuition', 'university', 'college ', 'school fee', 'udemy',
      'coursera', 'skillshare', 'pluralsight', 'khan academy',
      'masterclass', 'chegg',
    ],
  },
]

export function normalizeMerchantCategoryText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function suggestMerchantOverrideCategory(description: string): string | null {
  const normalized = ` ${normalizeMerchantCategoryText(description)} `
  if (!normalized.trim()) return null

  for (const rule of MERCHANT_CATEGORY_OVERRIDES) {
    if (rule.keywords.some((keyword) => normalized.includes(` ${normalizeMerchantCategoryText(keyword)} `))) {
      return rule.category
    }
  }

  return null
}
