import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BRAND_GREEN, brand, button, card, container, h1, main, text } from './brand'

interface Props {
  companyName?: string
  kind?: 'company' | 'municipality' | string
  decision?: 'approved' | 'rejected' | string
  decidedAt?: string
  reason?: string | null
  code?: string
  appUrl?: string
}

const box = {
  backgroundColor: 'rgba(255,255,255,0.06)',
  borderRadius: '14px',
  padding: '16px 18px',
  margin: '0 0 22px',
}

const label = {
  fontSize: '11px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: '#8FA79A',
  margin: '0 0 6px',
}

const value = { fontSize: '15px', color: '#ffffff', margin: '0', lineHeight: '1.5' }

const Email = ({
  companyName = 'Il tuo ente',
  kind = 'company',
  decision = 'approved',
  decidedAt,
  reason,
  code,
  appUrl = 'https://ciclaqui.it',
}: Props) => {
  const approved = decision === 'approved'
  const isMuni = kind === 'municipality'
  const members = isMuni ? 'cittadini' : 'dipendenti'
  const when = decidedAt
    ? new Date(decidedAt).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })
    : new Date().toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })

  return (
    <Html lang="it" dir="ltr">
      <Head />
      <Preview>
        {approved
          ? `${companyName} è stato approvato su Cicla Qui`
          : `Richiesta di ${companyName} non approvata su Cicla Qui`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Text style={brand}>Cicla Qui</Text>
            <Heading style={h1}>
              {approved
                ? `${companyName} è stato approvato`
                : `Richiesta di ${companyName} non approvata`}
            </Heading>

            <Text style={text}>
              {approved
                ? `La verifica dei dati e dei documenti si è conclusa con esito positivo: il tuo ${isMuni ? 'Comune' : "ente"} è ora attivo su Cicla Qui.`
                : `Abbiamo esaminato i dati e i documenti inviati, ma la richiesta non può essere approvata così com'è.`}
            </Text>

            <Section style={box}>
              <Text style={label}>Data della decisione</Text>
              <Text style={value}>{when}</Text>
            </Section>

            {!approved && (
              <Section style={box}>
                <Text style={label}>Motivazione</Text>
                <Text style={value}>{reason?.trim() || 'Nessun motivo specificato.'}</Text>
              </Section>
            )}

            {approved && code && (
              <Section style={box}>
                <Text style={label}>Codice ente</Text>
                <Text style={{ ...value, letterSpacing: '2px', fontWeight: 'bold' }}>{code}</Text>
              </Section>
            )}

            <Section style={box}>
              <Text style={label}>Prossimo passo</Text>
              <Text style={value}>
                {approved
                  ? `Attiva l'abbonamento dal pannello ente: da quel momento il codice diventa operativo e potrai distribuirlo ai tuoi ${members}.`
                  : `Aggiorna i dati e carica i documenti richiesti dal pannello ente, poi invia una nuova richiesta di revisione: la rivedremo entro 24–48h.`}
              </Text>
            </Section>

            <Link href={`${appUrl}/azienda`} style={button}>
              {approved ? 'Apri il pannello ente' : 'Aggiorna e reinvia'}
            </Link>

            <Text style={{ ...text, margin: '24px 0 0', fontSize: '13px' }}>
              Hai bisogno di aiuto? Rispondi a questa email oppure scrivici da{' '}
              <Link href={appUrl} style={{ color: BRAND_GREEN }}>
                ciclaqui.it
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data?.decision === 'rejected'
      ? `Richiesta non approvata — ${data?.companyName ?? 'il tuo ente'}`
      : `Ente approvato — ${data?.companyName ?? 'il tuo ente'}`,
  displayName: 'Esito verifica ente',
  previewData: {
    companyName: 'Comune di Verona',
    kind: 'municipality',
    decision: 'approved',
    decidedAt: new Date().toISOString(),
    code: 'VERO-4F2A',
    appUrl: 'https://ciclaqui.it',
  },
} satisfies TemplateEntry
