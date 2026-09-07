import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import { brand, button, card, container, h1, main, text } from './brand'

interface Props {
  companyName?: string
  planName?: string
  amountEur?: number
  fullPriceEur?: number | null
  discountLabel?: string | null
  periodEnd?: string | null
  seatsLabel?: string
  appUrl?: string
}

const box = {
  backgroundColor: 'rgba(255,255,255,0.06)',
  borderRadius: '14px',
  padding: '16px 18px',
  margin: '0 0 14px',
}

const label = {
  fontSize: '11px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: '#8FA79A',
  margin: '0 0 6px',
}

const value = { fontSize: '15px', color: '#ffffff', margin: '0', lineHeight: '1.5' }

const strike = { color: '#8FA79A', textDecoration: 'line-through' as const }

const eur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

const day = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—'

const Email = ({
  companyName = 'Il tuo ente',
  planName = 'Base',
  amountEur = 99,
  fullPriceEur = null,
  discountLabel = null,
  periodEnd = null,
  seatsLabel = '',
  appUrl = 'https://ciclaqui.it',
}: Props) => {
  const discounted = fullPriceEur != null && fullPriceEur > amountEur

  return (
    <Html lang="it" dir="ltr">
      <Head />
      <Preview>{`Pagamento ricevuto: piano ${planName} · ${eur(amountEur)}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Text style={brand}>Cicla Qui</Text>
            <Heading style={h1}>Pagamento ricevuto</Heading>

            <Text style={text}>
              Grazie {companyName}: il pagamento dell&apos;abbonamento è andato a buon fine.
              Ecco il riepilogo.
            </Text>

            <Section style={box}>
              <Text style={label}>Piano</Text>
              <Text style={value}>
                {planName}
                {seatsLabel ? ` · ${seatsLabel}` : ''}
              </Text>
            </Section>

            <Section style={box}>
              <Text style={label}>Totale pagato</Text>
              <Text style={value}>
                {discounted && fullPriceEur != null ? (
                  <>
                    <span style={strike}>{eur(fullPriceEur)}</span>{' '}
                  </>
                ) : null}
                {eur(amountEur)}
                {discountLabel ? ` (${discountLabel})` : ''}
              </Text>
            </Section>

            <Section style={box}>
              <Text style={label}>Valido fino al</Text>
              <Text style={value}>{day(periodEnd)}</Text>
            </Section>

            <Text style={text}>
              L&apos;abbonamento si rinnova automaticamente a questa data. Se cambi piano
              durante il periodo, il nuovo piano parte alla scadenza di quello già pagato.
            </Text>

            <Link href={`${appUrl}/azienda`} style={button}>
              Vai alla tua area
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: Email,
  displayName: 'Ente · Ricevuta abbonamento',
  subject: (d: Record<string, any>) =>
    `Pagamento ricevuto · piano ${d['planName'] ?? ''} – Cicla Qui`.replace('  ', ' '),
  previewData: {
    companyName: 'Acme Srl',
    planName: 'Intermedio',
    amountEur: 179.1,
    fullPriceEur: 199,
    discountLabel: 'sconto 10%',
    periodEnd: new Date(Date.now() + 30 * 864e5).toISOString(),
    seatsLabel: 'fino a 50 dipendenti',
  },
}
