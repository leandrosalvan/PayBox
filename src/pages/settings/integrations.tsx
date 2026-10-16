import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/settings/profile', permanent: false },
})

export default function IntegrationsRedirect() {
  return null
}
