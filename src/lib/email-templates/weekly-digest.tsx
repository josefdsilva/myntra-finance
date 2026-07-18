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
