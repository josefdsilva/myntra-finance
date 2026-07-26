import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface PlanItem {
  label: string
  amount: number
  direction: string
  funded: boolean
}

interface Props {
  siteName?: string
  appUrl?: string
  householdName?: string
  monthLabel?: string
  expectedIncome?: number
  plannedSpend?: number
  leftover?: number
  shortfall?: boolean
  plans?: PlanItem[]
  currency?: string
}

const fmt = (n: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(n))

const CycleStart = ({
  siteName = 'bynku',
  appUrl = 'https://bynku.app',
  householdName,
  monthLabel = '',
  expectedIncome = 0,
  plannedSpend = 0,
  leftover = 0,
  shortfall = false,
  plans = [],
  currency = 'EUR',
}: Props) => {
  const leftoverColor = shortfall ? '#b91c1c' : '#166534'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        A fresh cycle starts{monthLabel ? ` for ${monthLabel}` : ''} — here's what's planned
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>A fresh cycle begins</Heading>
          <Text style={muted}>
            {householdName ? `${householdName} · ` : ''}
            {monthLabel ? `${monthLabel} · ` : ''}Outlook from {siteName}
          </Text>

          <Section style={statCard}>
            <Row>
              <Column style={statCol}>
                <Text style={statLabel}>Expected income</Text>
                <Text style={statValue}>{fmt(expectedIncome, currency)}</Text>
              </Column>
              <Column style={statCol}>
                <Text style={statLabel}>Planned spend</Text>
                <Text style={statValue}>{fmt(plannedSpend, currency)}</Text>
              </Column>
            </Row>
            <Hr style={hr} />
            <Row>
              <Column style={statCol}>
                <Text style={statLabel}>{shortfall ? 'Projected shortfall' : 'Projected leftover'}</Text>
                <Text style={{ ...statValueSm, color: leftoverColor }}>{fmt(leftover, currency)}</Text>
              </Column>
            </Row>
          </Section>

          {plans.length > 0 ? (
            <Section>
              <Heading as="h3" style={h3}>
                Coming up this cycle
              </Heading>
              {plans.map((p, i) => (
                <Row key={`p-${i}`} style={listRow}>
                  <Column style={listLabel}>
                    {p.label}
                    <span style={p.funded ? fundedBadge : unfundedBadge}>
                      {p.funded ? 'Funded' : 'Set aside a project'}
                    </span>
                  </Column>
                  <Column style={{ ...listAmount, color: p.direction === 'income' ? '#166534' : '#0f172a' }}>
                    {p.direction === 'income' ? '+' : '−'}
                    {fmt(p.amount, currency)}
                  </Column>
                </Row>
              ))}
            </Section>
          ) : (
            <Text style={clearText}>No plans booked for this cycle — it looks clear.</Text>
          )}

          <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
            <Button style={button} href={`${appUrl}/cashflow`}>
              Review this cycle
            </Button>
          </Section>

          <Text style={footer}>
            You're receiving this because cycle updates are enabled for your household. Update your
            preferences in{' '}
            <Link href={`${appUrl}/settings`} style={link}>
              Settings
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default CycleStart

export const template = {
  component: CycleStart,
  subject: (data: Record<string, any>) =>
    data?.monthLabel ? `Your ${data.monthLabel} cycle outlook` : 'Your new cycle outlook',
  displayName: 'Cycle start',
  previewData: {
    siteName: 'bynku',
    appUrl: 'https://bynku.app',
    householdName: 'Home',
    monthLabel: 'August 2026',
    expectedIncome: 2600,
    plannedSpend: 740,
    leftover: 410,
    shortfall: false,
    plans: [
      { label: 'Car insurance', amount: 480, direction: 'expense', funded: true },
      { label: 'Dentist', amount: 260, direction: 'expense', funded: false },
      { label: 'Freelance invoice', amount: 300, direction: 'income', funded: false },
    ],
    currency: 'EUR',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0f172a', margin: '0 0 4px' }
const h3 = { fontSize: '14px', fontWeight: 'bold' as const, color: '#0f172a', margin: '20px 0 8px' }
const muted = { fontSize: '12px', color: '#64748b', margin: '0 0 16px' }
const hr = { borderColor: '#e2e8f0', margin: '12px 0' }
const statCard = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '16px 18px',
  margin: '8px 0 16px',
}
const statCol = { verticalAlign: 'top' as const, padding: '4px 6px' }
const statLabel = { fontSize: '11px', color: '#64748b', margin: 0, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const statValue = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0f172a', margin: '4px 0 2px' }
const statValueSm = { fontSize: '16px', fontWeight: 'bold' as const, color: '#0f172a', margin: '4px 0 2px' }
const listRow = { borderBottom: '1px solid #e2e8f0', padding: '6px 0' }
const listLabel = { fontSize: '13px', color: '#0f172a', padding: '4px 0' }
const listAmount = { fontSize: '13px', textAlign: 'right' as const, fontWeight: 'bold' as const, padding: '4px 0' }
const clearText = { fontSize: '13px', color: '#64748b', margin: '8px 0 0' }
const fundedBadge = {
  fontSize: '10px',
  color: '#166534',
  border: '1px solid #bbf7d0',
  borderRadius: '6px',
  padding: '1px 6px',
  marginLeft: '8px',
}
const unfundedBadge = {
  fontSize: '10px',
  color: '#b45309',
  border: '1px solid #fde68a',
  borderRadius: '6px',
  padding: '1px 6px',
  marginLeft: '8px',
}
const button = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '10px',
  padding: '12px 20px',
  textDecoration: 'none',
  display: 'inline-block',
}
const link = { color: '#0f172a', textDecoration: 'underline' }
const footer = { fontSize: '11px', color: '#94a3b8', margin: '20px 0 0', lineHeight: '1.5' }
