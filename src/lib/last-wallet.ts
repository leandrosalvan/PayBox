import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

const KEY = 'paybox:wallet'

export const WALLET_BASE = '/wallet'

export function setLastWalletId(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {}
}

function getLastWalletId() {
  try {
    return localStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function openWallet(router: { push: (url: string) => unknown }, id: string) {
  setLastWalletId(id)
  router.push(WALLET_BASE)
}

/** The wallet behind the friendly /wallet URLs: the last one the user opened. Old /wallets/:id URLs are adopted and rewritten. */
export function useWalletId(): string | undefined {
  const router = useRouter()
  const fromUrl = typeof router.query.walletId === 'string' ? router.query.walletId : undefined
  const [stored, setStored] = useState<string>()

  useEffect(() => {
    if (!router.isReady) return
    if (fromUrl) {
      setLastWalletId(fromUrl)
      router.replace(WALLET_BASE + router.asPath.replace(/^\/wallets\/[^/?#]+/, ''))
      return
    }
    const last = getLastWalletId()
    if (last) setStored(last)
    else router.replace('/wallets')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, fromUrl])

  return fromUrl ?? stored
}
