/**
 * Keyword-based category suggester.
 * Runs locally with no API call, covers ~70-80% of common merchants.
 * Matches against the UPPERCASED raw description string.
 */

interface KeywordRule {
  keywords: string[]
  category: string
}

const RULES: KeywordRule[] = [
  {
    keywords: [
      'SUPERCHARGER', 'GAS STATION', 'GAS PUMP', 'GAS MART',
      'FUEL', 'SHELL', 'EXXON', 'CHEVRON', 'MOBIL', 'BP OIL',
      'SUNOCO', 'ARCO', 'MARATHON', 'CIRCLE K', 'QUIK TRIP', 'QUICKTRIP',
      'WAWA', 'BLINK CHARGING', 'CHARGEPOINT', 'ELECTRIFY AMERICA',
      'EV CHARGE', 'EVGO', 'VARSITY ENERGY',
    ],
    category: 'Gas & EV Charging',
  },
  {
    keywords: [
      'RESTAURANT', 'PIZZA', 'BURGER', 'DOORDASH', 'UBER EATS', 'UBEREATS',
      'GRUBHUB', 'CAFE', 'COFFEE', 'DUNKIN', 'STARBUCKS', 'SUBWAY',
      'TACO BELL', 'TACO BU', 'CHICKEN', 'BBQ', 'BAGEL', 'WAFFLE HOUSE',
      'SUSHI', 'CHIPOTLE', 'CHICK-FIL', 'MCDONALD', 'WENDY',
      'BURGER KING', 'PANERA', 'SONIC', 'DAIRY QUEEN', 'FIVE GUYS',
      'POPEYE', 'WHATABURGER', 'IN-N-OUT', 'PANDA EXPRESS',
      'DOMINOS', 'PAPA JOHN', 'LITTLE CAESAR', 'CRACKER BARREL',
      'OLIVE GARDEN', 'APPLEBEE', 'IHOP', 'DENNY', 'WAFFLE',
      'SMOOTHIE KING', 'JAMBA JUICE', 'COLD STONE', 'BASKIN',
      'JIMMY JOHN', 'JERSEY MIKE', 'POTBELLY', 'FIREHOUSE',
      'SWEETGREEN', 'SHAKE SHACK', 'HABIT BURGER', 'CULVER',
    ],
    category: 'Dining',
  },
  {
    keywords: [
      'WALMART', 'WAL-MART', 'TARGET', 'COSTCO', 'KROGER', 'HEB ',
      'H-E-B', 'WHOLE FOODS', 'GROCERY', 'MARKET', 'ALDI', 'LIDL',
      'SAFEWAY', 'PUBLIX', 'WEGMANS', 'TRADER JOE', 'SPROUTS',
      'FRESH MARKET', 'FOOD LION', 'GIANT FOOD', 'HARRIS TEETER',
      'MEIJER', 'SAM\'S CLUB', 'BJ\'S WHOLESALE', 'MARKET BASKET',
    ],
    category: 'Groceries',
  },
  {
    keywords: [
      'AMAZON', 'AMZN', 'NORDSTROM', 'NIKE', 'ZARA', 'H&M', 'HM.COM',
      'UNIQLO', 'HOLLISTER', 'PATAGONIA', 'DOLLAR TREE', 'HOBBY LOBBY',
      'MICHAELS', 'AT HOME', 'BEST BUY', 'APPLE STORE', 'APPLE.COM',
      'EBAY', 'ETSY', 'TIKTOK SHOP', 'SHEIN', 'ASOS', 'WAYFAIR',
      'OVERSTOCK', 'CHEWY', 'PETCO', 'PETSMART', 'HOME DEPOT',
      'LOWE\'S', 'LOWES', 'IKEA', 'PIER 1', 'TUESDAY MORNING',
      'ROSS STORES', 'ROSS DRESS', 'TJ MAXX', 'TJMAXX', 'MARSHALLS',
      'BURLINGTON', 'OLD NAVY', 'GAP ', 'BANANA REPUBLIC',
      'VICTORIA SECRET', 'BATH BODY', 'SEPHORA', 'ULTA',
      'FEDEX', 'UPS ', 'USPS', 'ENEBA', 'G2A ', 'STEAM GAMES',
    ],
    category: 'Shopping',
  },
  {
    keywords: [
      'AIRLINE', 'FRONTIER', 'AMERICAN AIR', 'UNITED AIRLINE',
      'DELTA', 'SOUTHWEST', 'SPIRIT AIRLINE', 'JETBLUE', 'ALLEGIANT',
      'ALASKA AIRLINE', 'HOTEL', 'AIRBNB', 'MARRIOTT', 'HILTON',
      'HYATT', 'WESTIN', 'SHERATON', 'HOLIDAY INN', 'HAMPTON INN',
      'RESIDENCE INN', 'COURTYARD', 'DOUBLETREE', 'VRBO',
      'BOOKING.COM', 'EXPEDIA', 'HOTELS.COM', 'KAYAK', 'PRICELINE',
      'HERTZ', 'AVIS', 'ENTERPRISE RENT', 'NATIONAL CAR',
      'NUSUK', 'HAJJ', 'AMTRAK', 'GREYHOUND',
    ],
    category: 'Travel',
  },
  {
    keywords: [
      'LYFT', 'UBER ', 'UBER*TRIP', 'PARKING', 'NTTA ', 'TOLL ',
      'TOLLWAY', 'TRANSIT', 'METRO ', 'BUS FARE', 'ZIPCAR',
      'BIRD SCOOTER', 'LIME ', 'TURO ', 'CITY BIKE',
    ],
    category: 'Transportation',
  },
  {
    keywords: [
      'NETFLIX', 'SPOTIFY', 'DISNEY+', 'DISNEYPLUS', 'HULU',
      'YOUTUBE PREMIUM', 'APPLE.COM/BILL', 'APPLE ONE',
      'CLAUDE.AI', 'ANTHROPIC', 'CHATGPT', 'OPENAI',
      'MICROSOFT 365', 'ADOBE ', 'DROPBOX', 'GOOGLE ONE',
      'ICLOUD', 'PARAMOUNT', 'HBO MAX', 'PEACOCK',
      'AMAZON PRIME', 'AUDIBLE', 'KINDLE UNLIMITED',
      'DUOLINGO', 'CALM ', 'HEADSPACE', 'NYTIMES',
      'WASHINGTON POST', 'WALL STREET JOURNAL',
    ],
    category: 'Subscriptions',
  },
  {
    keywords: [
      'CVS PHARM', 'CVS/PHARM', 'PHARMACY', 'WALGREEN', 'RITE AID',
      'HOSPITAL', 'DENTAL', 'MEDICAL ', 'CLINIC', 'OPTOMETRIST',
      'URGENT CARE', 'PEDIATRIC', 'DERMATOLOG', 'ORTHOPEDIC',
      'AGA KHAN', 'CIGNA', 'AETNA', 'BLUE CROSS', 'DOCTOR ',
      'LAB CORP', 'QUEST DIAG',
    ],
    category: 'Health & Medical',
  },
  {
    keywords: [
      'GEICO', 'STATE FARM', 'ALLSTATE', 'PROGRESSIVE INS',
      'TRAVELERS INS', 'NATIONWIDE INS', 'FARMERS INS',
      'LIBERTY MUTUAL', 'USAA INSURANCE', 'INSURANCE PREM',
    ],
    category: 'Insurance',
  },
  {
    keywords: [
      'MASJID', 'MOSQUE', 'ISLAMIC CENTER', 'CHURCH', 'SYNAGOGUE',
      'CHARITY', 'DONATION', 'ICNA ', 'ZEFFY', 'ZAKAAT',
      'ZAKAT', 'LAUNCHGOOD', 'GOFUNDME', 'GIVE.ORG',
      'UNITED WAY', 'RED CROSS', 'SALVATION ARMY',
    ],
    category: 'Donations & Charity',
  },
  {
    keywords: [
      'PLANET FITNESS', 'LA FITNESS', 'EQUINOX', 'GYM', 'FITNESS',
      'AMPED ', 'CROSSFIT', 'ORANGETHEORY', 'ANYTIME FITNESS',
      'YMCA', 'GOLD\'S GYM', 'CRUNCH FITNESS', 'LIFETIME FIT',
    ],
    category: 'Fitness',
  },
  {
    keywords: [
      'RING ALARM', 'RING.COM', 'ELECTRIC', 'ELECTRICITY',
      'WATER BILL', 'NATURAL GAS', 'INTERNET ', 'XFINITY',
      'AT&T INTERNET', 'SPECTRUM ', 'COX COMM', 'WASTE MGMT',
      'HOME DEPOT', 'LOWES', 'ACE HARDWARE',
    ],
    category: 'Home & Utilities',
  },
  {
    keywords: [
      'BARBER', 'BARBERSHOP', 'SALON', 'HAIR CUT', 'HAIR SALON',
      'SPA ', 'NAIL SALON', 'GREAT CLIPS', 'SUPERCUTS',
      'PRO FADE', 'FLOYD\'S',
    ],
    category: 'Personal Care',
  },
  {
    keywords: [
      'ATOM TICKETS', 'FANDANGO', 'AMC THEATRES', 'REGAL CINEMA',
      'CINEMA', 'MOVIE', 'DAVE & BUSTER', 'BOWLERO', 'TOPGOLF',
      'MAIN EVENT', 'ARCADE', 'STEAM ', 'XBOX ', 'PLAYSTATION',
      'NINTENDO', 'GAMESTOP', 'WIZARD101', 'TWITCH', 'ENEBA',
    ],
    category: 'Entertainment',
  },
  {
    keywords: [
      'AT&T WIRELESS', 'VERIZON WIRELESS', 'T-MOBILE', 'SPRINT ',
      'US CELLULAR', 'MINT MOBILE', 'CRICKET WIRELESS', 'BOOST MOBILE',
      'METRO PCS', 'GOOGLE FI',
    ],
    category: 'Telecom',
  },
  {
    keywords: [
      'TUITION', 'UNIVERSITY', 'COLLEGE ', 'SCHOOL FEE',
      'UDEMY', 'COURSERA', 'SKILLSHARE', 'PLURALSIGHT',
      'KHAN ACADEMY', 'MASTERCLASS', 'CHEGG',
    ],
    category: 'Education',
  },
]

/**
 * Suggest a category for a transaction description using keyword matching.
 * Returns null if no match is found.
 */
export function suggestCategory(description: string): string | null {
  const upper = description.toUpperCase()
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => upper.includes(kw))) {
      return rule.category
    }
  }
  return null
}
