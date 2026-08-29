import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import {
  brand,
  button,
  card,
  container,
  footer,
  h1,
  main,
  text,
} from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Reimposta la password di Cicla Qui</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>Cicla Qui</Text>
          <Heading style={h1}>Reimposta la password</Heading>
          <Text style={text}>
            Abbiamo ricevuto una richiesta di reimpostazione password per il
            tuo account Cicla Qui. Clicca il pulsante per sceglierne una nuova.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Reimposta password
          </Button>
          <Text style={footer}>
            Se non hai richiesto il reset, ignora questa email: la tua password
            resterà invariata.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
