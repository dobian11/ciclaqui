import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
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
  link,
  main,
  text,
} from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Conferma la tua email per Cicla Qui</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>Cicla Qui</Text>
          <Heading style={h1}>Conferma la tua email</Heading>
          <Text style={text}>
            Grazie per esserti registrato su{' '}
            <Link href={siteUrl} style={link}>
              Cicla Qui
            </Link>
            . Conferma l'indirizzo <strong>{recipient}</strong> per iniziare a
            guadagnare punti pedalando.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Verifica email
          </Button>
          <Text style={footer}>
            Se non hai creato un account, puoi ignorare questa email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
