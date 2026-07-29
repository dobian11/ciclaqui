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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Sei stato invitato su Cicla Qui</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Text style={brand}>Cicla Qui</Text>
          <Heading style={h1}>Sei stato invitato</Heading>
          <Text style={text}>
            Hai ricevuto un invito a entrare su{' '}
            <Link href={siteUrl} style={link}>
              Cicla Qui
            </Link>
            . Accetta l'invito per creare il tuo account e iniziare a
            raccogliere punti sugli spostamenti sostenibili.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Accetta invito
          </Button>
          <Text style={footer}>
            Se non ti aspettavi questo invito, puoi ignorare questa email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
