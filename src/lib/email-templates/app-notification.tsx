import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import { brand, button, card, container, footer, h1, main, text } from './brand'

interface Props {
  title?: string
  message?: string
  /** Righe di dettaglio opzionali: [{ label, value }] */
  details?: { label: string; value: string }[]
  ctaLabel?: string
  ctaUrl?: string
  /** Codice/voucher da evidenziare (es. riscatto premio). */
  code?: string
}

const box = {
  backgroundColor: 'rgba(255,255,255,0.06)',
  borderRadius: '14px',
  padding: '14px 18px',
  margin: '0 0 14px',
}
const label = {
  fontSize: '11px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: '#8FA79A',
  margin: '0 0 4px',
}
const value = { fontSize: '15px', color: '#ffffff', margin: '0', lineHeight: '1.5' }
const codeBox = {
  ...box,
  textAlign: 'center' as const,
  fontFamily: "'Space Grotesk', Courier, monospace",
  fontSize: '26px',
  letterSpacing: '4px',
  color: '#12B76A',
  fontWeight: 'bold' as const,
}

const Email = ({
  title = 'Aggiornamento Cicla Qui',
  message = 'C’è una novità sul tuo account.',
  details = [],
  ctaLabel = 'Apri Cicla Qui',
  ctaUrl = 'https://ciclaqui.it',
  code,
}: Props) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>{title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>Cicla Qui</Text>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>{message}</Text>

          {code ? <Section style={codeBox}>{code}</Section> : null}

          {details.map((d) => (
            <Section key={d.label} style={box}>
              <Text style={label}>{d.label}</Text>
              <Text style={value}>{d.value}</Text>
            </Section>
          ))}

          <Link href={ctaUrl} style={button}>
            {ctaLabel}
          </Link>
        </Section>
        <Text style={footer}>
          Ricevi questa email perché sei iscritto a Cicla Qui. Puoi gestire le notifiche dal
          tuo profilo, sezione Notifiche.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => (data?.title as string) || 'Aggiornamento Cicla Qui',
  displayName: 'Notifica app',
  previewData: {
    title: 'Prelievo pagato',
    message: 'Il tuo ente ha effettuato il bonifico sul tuo IBAN.',
    details: [{ label: 'Importo', value: '€ 24,50' }],
    ctaLabel: 'Vedi i tuoi punti',
    ctaUrl: 'https://ciclaqui.it/app/punti',
  },
} satisfies TemplateEntry
