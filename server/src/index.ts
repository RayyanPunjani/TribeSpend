import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import cron from 'node-cron'
import plaidRouter from './routes/plaid'
import { syncAllItems } from './syncService'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
  }),
)
app.use(express.json())

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api/plaid', plaidRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Scheduled sync (every 30 minutes) ────────────────────────────────────────

cron.schedule('*/30 * * * *', async () => {
  console.log('[cron] Starting scheduled Plaid sync...')
  try {
    const result = await syncAllItems()
    console.log(
      `[cron] Sync complete: +${result.totalAdded} transactions, ${result.errors.length} errors`,
    )
  } catch (err) {
    console.error('[cron] Scheduled sync failed:', err)
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🏦 TribeSpend server running on http://localhost:${PORT}`)
  console.log(`   Plaid env: ${process.env.PLAID_ENV || 'sandbox'}`)
  console.log(`   Database: ${process.env.DATABASE_URL || './tribespend.db'}\n`)
})

export default app
