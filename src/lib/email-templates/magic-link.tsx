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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Il tuo link di accesso a Cicla Qui</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>Cicla Qui</Text>
          <Heading style={h1}>Il tuo link di accesso</Heading>
          <Text style={text}>
            Clicca il pulsante qui sotto per accedere a Cicla Qui. Il link
            scade a breve.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Accedi
          </Button>
          <Text style={footer}>
            Se non hai richiesto questo link, ignora pure questa email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
