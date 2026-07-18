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

interface TopItem {
  label: string
  amount: number
}

interface Props {
  siteName?: string
  appUrl?: string
  householdName?: string
  spentLast?: number
  spentPrev?: number
  receivedLast?: number
  variablePool?: number
  surplus?: number
  topSpent?: TopItem[]
  topReceived?: TopItem[]
  aiOutlook?: string
  currency?: string
}

const fmt = (n: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(n))

const WeeklyDigest = ({
  siteName = 'bynku',
  appUrl = 'https://bynku.app',
  householdName,
  spentLast = 0,
  spentPrev = 0,
  receivedLast = 0,
  variablePool = 0,
  surplus = 0,
  topSpent = [],
  topReceived = [],
  aiOutlook,
  currency = 'EUR',
}: Props) => {
  const trend = spentLast - spentPrev
  const trendLabel = trend >= 0 ? `+${fmt(trend, currency)}` : fmt(trend, currency)
  const trendColor = trend > 0 ? '#b91c1c' : '#166534'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        Your {siteName} weekly overview — spent {fmt(spentLast, currency)} this week
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your week at a glance</Heading>
          <Text style={muted}>
            {householdName ? `${householdName} · ` : ''}Weekly overview from {siteName}
          </Text>

          <Section style={statCard}>
            <Row>
              <Column style={statCol}>
                <Text style={statLabel}>Spent this week</Text>
                <Text style={statValue}>{fmt(spentLast, currency)}</Text>
                <Text style={{ ...statHint, color: trendColor }}>{trendLabel} vs last week</Text>
              </Column>
              <Column style={statCol}>
                <Text style={statLabel}>Received</Text>
                <Text style={statValue}>{fmt(receivedLast, currency)}</Text>
                <Text style={statHint}>This week</Text>
              </Column>
            </Row>
            <Hr style={hr} />
            <Row>
              <Column style={statCol}>
                <Text style={statLabel}>Variable pool left</Text>
                <Text style={statValueSm}>{fmt(variablePool, currency)}</Text>
              </Column>
              <Column style={statCol}>
                <Text style={statLabel}>Monthly surplus</Text>
                <Text style={statValueSm}>{fmt(surplus, currency)}</Text>
              </Column>
            </Row>
          </Section>

          {aiOutlook ? (
            <Section style={aiBox}>
              <Text style={aiLabel}>Coach note</Text>
              <Text style={aiText}>{aiOutlook}</Text>
            </Section>
          ) : null}

          {topSpent.length > 0 ? (
            <Section>
              <Heading as="h3" style={h3}>
                Top spending
              </Heading>
              {topSpent.map((it, i) => (
                <Row key={`s-${i}`} style={listRow}>
                  <Column style={listLabel}>{it.label}</Column>
                  <Column style={listAmount}>{fmt(it.amount, currency)}</Column>
                </Row>
              ))}
            </Section>
          ) : null}

          {topReceived.length > 0 ? (
            <Section>
              <Heading as="h3" style={h3}>
                Top income
              </Heading>
              {topReceived.map((it, i) => (
                <Row key={`r-${i}`} style={listRow}>
                  <Column style={listLabel}>{it.label}</Column>
                  <Column style={listAmount}>{fmt(it.amount, currency)}</Column>
                </Row>
              ))}
            </Section>
          ) : null}

          <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
            <Button style={button} href={`${appUrl}/analysis`}>
              Open the full analysis
            </Button>
          </Section>

          <Text style={footer}>
            You're receiving this because weekly digests are enabled for your household. Update
            your preferences in{' '}
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

export default WeeklyDigest

export const template = {
  component: WeeklyDigest,
  subject: 'Your bynku weekly overview',
  displayName: 'Weekly digest',
  previewData: {
    siteName: 'bynku',
    appUrl: 'https://bynku.app',
    householdName: 'Home',
    spentLast: 384,
    spentPrev: 421,
    receivedLast: 1500,
    variablePool: 620,
    surplus: 310,
    topSpent: [
      { label: 'Supermarket', amount: 128 },
      { label: 'Restaurants', amount: 72 },
      { label: 'Fuel', amount: 55 },
    ],
    topReceived: [{ label: 'Salary top-up', amount: 1500 }],
    aiOutlook:
      "You're pacing €37 below last week — nice. At this rate you'll finish the cycle with your pool intact; consider auto-sweeping the surplus into your emergency bucket.",
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
const statHint = { fontSize: '11px', color: '#64748b', margin: 0 }
const aiBox = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', margin: '4px 0 16px' }
const aiLabel = { fontSize: '11px', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 4px' }
const aiText = { fontSize: '13px', color: '#0f172a', lineHeight: '1.5', margin: 0 }
const listRow = { borderBottom: '1px solid #e2e8f0', padding: '6px 0' }
const listLabel = { fontSize: '13px', color: '#0f172a', padding: '4px 0' }
const listAmount = { fontSize: '13px', color: '#0f172a', textAlign: 'right' as const, fontWeight: 'bold' as const, padding: '4px 0' }
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
