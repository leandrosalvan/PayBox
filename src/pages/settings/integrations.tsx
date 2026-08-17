import { useEffect, useMemo, useState } from 'react'
import type { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy, KeyRound, Plug, ShieldCheck, Trash2 } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import { hasMcpWriteScope, type McpScope } from '@/lib/mcp/scopes'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

type Credential = {
  id: string
  name: string
  tokenPrefix: string
  scopes: McpScope[]
  writeEnabled: boolean
  createdAt: string
}

const scopeOptions: Array<{ value: Exclude<McpScope, 'read'>; label: string; description: string }> = [
  { value: 'write:expenses', label: 'Despesas', description: 'Criar, editar, pagar e excluir despesas.' },
  { value: 'write:categories', label: 'Categorias', description: 'Criar, editar e excluir categorias.' },
  { value: 'write:wallets', label: 'Criar carteiras', description: 'Criar novas carteiras na sua conta.' },
  { value: 'admin:wallets', label: 'Administrar carteiras', description: 'Editar ou excluir carteiras onde você é proprietário.' },
  { value: 'admin:members', label: 'Membros e convites', description: 'Gerenciar salários, membros e convites.' },
]

export default function IntegrationsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [name, setName] = useState('Minha integração')
  const [selectedScopes, setSelectedScopes] = useState<McpScope[]>(['read'])
  const [generatedToken, setGeneratedToken] = useState('')
  const [origin, setOrigin] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const endpoint = origin ? `${origin}/api/mcp` : ''
  const clientConfig = useMemo(() => JSON.stringify({
    mcpServers: {
      paybox: {
        type: 'http',
        url: endpoint || 'https://seu-paybox.com/api/mcp',
        headers: { Authorization: `Bearer ${generatedToken || 'SEU_TOKEN'}` },
      },
    },
  }, null, 2), [endpoint, generatedToken])

  useEffect(() => {
    setOrigin(window.location.origin)
    void loadCredentials()
  }, [])

  async function loadCredentials() {
    setLoading(true)
    const response = await fetch('/api/mcp/credentials')
    if (response.ok) {
      const data = await response.json()
      setCredentials(data.credentials)
    } else {
      setError('Não foi possível carregar as integrações')
    }
    setLoading(false)
  }

  function toggleScope(scope: Exclude<McpScope, 'read'>) {
    setSelectedScopes((current) => current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope])
  }

  async function createCredential(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    setGeneratedToken('')
    const response = await fetch('/api/mcp/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scopes: selectedScopes }),
    })
    const data = await response.json()
    if (response.ok) {
      setGeneratedToken(data.token)
      setName('Minha integração')
      setSelectedScopes(['read'])
      setMessage('Integração criada. Copie o token agora; ele não será exibido novamente.')
      await loadCredentials()
    } else {
      setError(data.error || 'Não foi possível criar a integração')
    }
    setSaving(false)
  }

  async function revokeCredential(credential: Credential) {
    if (!confirm(`Revogar a integração “${credential.name}”? O cliente perderá o acesso imediatamente.`)) return
    const response = await fetch(`/api/mcp/credentials/${credential.id}`, { method: 'DELETE' })
    if (response.ok) {
      if (generatedToken.startsWith(credential.tokenPrefix.replace('…', ''))) setGeneratedToken('')
      setMessage('Integração revogada')
      await loadCredentials()
    } else {
      const data = await response.json()
      setError(data.error || 'Não foi possível revogar a integração')
    }
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value)
      setMessage(successMessage)
      setError('')
    } catch {
      setError('Não foi possível copiar para a área de transferência')
    }
  }

  return (
    <AppLayout title="Integrações MCP - PayBox">
      <div className="py-4">
        <Link href="/wallets" className="mb-4 inline-flex items-center text-slate-400 hover:text-white">
          <ArrowLeft size={20} className="mr-1" /> Voltar para carteiras
        </Link>

        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-xl bg-primary-500/15 p-3 text-primary-400"><Plug size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold">Integrações MCP</h1>
            <p className="mt-1 text-sm text-slate-400">
              Conecte o PayBox a assistentes e clientes compatíveis com MCP via Streamable HTTP.
            </p>
          </div>
        </div>

        {message && <p className="mb-4 rounded-lg bg-primary-500/10 px-3 py-2 text-sm text-primary-300">{message}</p>}
        {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        {generatedToken && (
          <Card className="mb-6 border-amber-500/60 bg-amber-500/10">
            <div className="mb-2 flex items-center gap-2 text-amber-300">
              <KeyRound size={18} /> <strong>Token exibido uma única vez</strong>
            </div>
            <p className="mb-3 text-sm text-slate-300">Guarde-o no cliente MCP. O PayBox armazena somente o hash.</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-dark-900 px-3 py-2 text-xs text-slate-200">{generatedToken}</code>
              <Button size="sm" onClick={() => copyText(generatedToken, 'Token copiado')} aria-label="Copiar token">
                <Copy size={16} />
              </Button>
            </div>
          </Card>
        )}

        <Card className="mb-6">
          <h2 className="mb-1 text-lg font-semibold">Nova integração</h2>
          <p className="mb-4 text-sm text-slate-400">Toda integração pode consultar apenas as carteiras das quais você participa.</p>
          <form onSubmit={createCredential} className="space-y-4">
            <Input label="Nome" value={name} onChange={(event) => setName(event.target.value)} maxLength={50} required />

            <div>
              <p className="mb-2 text-sm font-medium text-slate-300">Permissões</p>
              <div className="mb-2 flex items-center gap-3 rounded-lg border border-primary-500/30 bg-primary-500/10 p-3">
                <Check size={17} className="text-primary-400" />
                <div>
                  <p className="text-sm font-medium">Consultar dados</p>
                  <p className="text-xs text-slate-400">Sempre habilitado.</p>
                </div>
              </div>
              <div className="space-y-2">
                {scopeOptions.map((option) => {
                  const checked = selectedScopes.includes(option.value)
                  return (
                    <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 p-3 hover:bg-dark-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleScope(option.value)}
                        className="mt-1 h-4 w-4 accent-emerald-500"
                      />
                      <span>
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="block text-xs text-slate-400">{option.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {hasMcpWriteScope(selectedScopes) && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Esta credencial poderá alterar dados. Exclusões continuam exigindo prévia e confirmação explícita.
              </p>
            )}
            <Button type="submit" className="w-full" isLoading={saving}>Gerar credencial</Button>
          </form>
        </Card>

        <Card className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary-400" />
            <h2 className="text-lg font-semibold">Credenciais ativas</h2>
          </div>
          {loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          ) : credentials.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma integração ativa.</p>
          ) : (
            <div className="space-y-3">
              {credentials.map((credential) => (
                <div key={credential.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-700 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{credential.name}</p>
                    <code className="text-xs text-slate-400">{credential.tokenPrefix}</code>
                    <p className="mt-1 text-xs text-slate-500">
                      {credential.writeEnabled ? `${credential.scopes.length - 1} permissões de escrita` : 'Somente leitura'} · criada em {new Date(credential.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => revokeCredential(credential)} aria-label={`Revogar ${credential.name}`}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 text-lg font-semibold">Configuração do cliente</h2>
          <p className="mb-3 text-sm text-slate-400">
            Use a URL abaixo em clientes com suporte a Streamable HTTP e envie o token no cabeçalho Authorization.
          </p>
          <div className="mb-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-dark-900 px-3 py-2 text-xs text-slate-200">{endpoint || '/api/mcp'}</code>
            <Button variant="secondary" size="sm" onClick={() => copyText(endpoint, 'URL copiada')} disabled={!endpoint} aria-label="Copiar URL">
              <Copy size={16} />
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-dark-900 p-3 text-xs text-slate-300">{clientConfig}</pre>
          <Button variant="secondary" className="mt-3 w-full" onClick={() => copyText(clientConfig, 'Configuração copiada')}>
            <Copy size={16} className="mr-2" /> Copiar configuração
          </Button>
        </Card>
      </div>
    </AppLayout>
  )
}
