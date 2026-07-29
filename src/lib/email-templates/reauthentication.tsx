import * as React from 'react'

import {
  Body,
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
  card,
  codeStyle,
  container,
  footer,
  h1,
  main,
  text,
} from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({
  token,
}: ReauthenticationEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Il tuo codice di verifica Cicla Qui</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>Cicla Qui</Text>
          <Heading style={h1}>Conferma la tua identità</Heading>
          <Text style={text}>Usa il codice qui sotto per continuare:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            Il codice scade a breve. Se non hai richiesto tu questa verifica,
            ignora questa email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
