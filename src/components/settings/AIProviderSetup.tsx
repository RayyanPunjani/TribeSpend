import { useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'

const MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-5',
  'claude-haiku-4-5-20251001',
]

export default function AIProviderSetup() {
  const { settings, update } = useSettingsStore()
  const [keyVisible, setKeyVisible] = useState(false)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  function handleValidate() {
    const key = settings.anthropicApiKey.trim()
    const looksValid = /^sk-ant-[a-zA-Z0-9_-]{20,}$/.test(key)
    setValidationStatus(looksValid ? 'ok' : 'fail')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Claude API Key</h3>
        <p className="text-xs text-slate-500 mb-3">
          Your key is stored locally in your browser's IndexedDB and only sent to
          api.anthropic.com during statement parsing. It never leaves your device.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={keyVisible ? 'text' : 'password'}
              value={settings.anthropicApiKey}
              onChange={(e) => {
                update({ anthropicApiKey: e.target.value })
                setValidationStatus('idle')
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 pr-16"
              placeholder="sk-ant-api03-..."
            />
            <button
              type="button"
              onClick={() => setKeyVisible((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              {keyVisible ? 'Hide' : 'Show'}
            </button>
          </div>
          <button
            onClick={handleValidate}
            disabled={!settings.anthropicApiKey}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <CheckCircle size={14} /> Test Key
          </button>
        </div>

        {validationStatus === 'ok' && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
            <CheckCircle size={14} /> Key format looks valid.
          </div>
        )}
        {validationStatus === 'fail' && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
            <XCircle size={14} /> Key format invalid — Anthropic keys start with sk-ant-
          </div>
        )}

        <p className="text-xs text-slate-400 mt-2">
          Note: Live connection tests aren't possible from the browser due to CORS. Key format is validated instead.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Model</label>
        <select
          value={settings.anthropicModel}
          onChange={(e) => update({ anthropicModel: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-1">
          claude-sonnet-4-20250514 offers the best accuracy for statement parsing.
        </p>
      </div>
    </div>
  )
}
