import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'
import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

// ── Plaid client ──────────────────────────────────────────────────────────────

const plaidEnv = (process.env.PLAID_ENV || 'sandbox') as keyof typeof PlaidEnvironments

const config = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
})

export const plaidClient = new PlaidApi(config)

// ── Token encryption (AES-256-CBC) ───────────────────────────────────────────

const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.SESSION_SECRET || 'fallback-dev-key-change-in-prod',
  'tribespend-plaid-salt',
  32,
)
const IV_LENGTH = 16

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, encryptedHex] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

// ── Link token ────────────────────────────────────────────────────────────────

export async function createLinkToken(clientUserId = 'local-user') {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: clientUserId },
    client_name: 'TribeSpend',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  })
  return response.data.link_token
}

// ── Public token exchange ─────────────────────────────────────────────────────

export async function exchangePublicToken(publicToken: string) {
  const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken })
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  }
}

// ── Item removal ──────────────────────────────────────────────────────────────

export async function removeItem(accessToken: string) {
  await plaidClient.itemRemove({ access_token: accessToken })
}

// ── Account info ──────────────────────────────────────────────────────────────

export async function getAccounts(accessToken: string) {
  const response = await plaidClient.accountsGet({ access_token: accessToken })
  return response.data.accounts
}
