export type DocSpec = {
  key: string;
  label: string;
  hint: string;
  required: boolean;
  match: string[];
};

export const COMPANY_DOCS: DocSpec[] = [
  { key: "visura", label: "Visura camerale", hint: "Non più vecchia di 6 mesi", required: true, match: ["visura", "camera", "cciaa"] },
  { key: "identita", label: "Documento del legale rappresentante", hint: "Carta d'identità o passaporto in corso di validità", required: true, match: ["identita", "identità", "carta", "passaporto", "cie", "documento"] },
  { key: "statuto", label: "Statuto o atto costitutivo", hint: "Per società e associazioni", required: true, match: ["statuto", "atto", "costitut"] },
  { key: "iban", label: "Certificazione IBAN", hint: "Coordinate bancarie intestate all'azienda", required: true, match: ["iban", "banca", "coordinate", "conto"] },
];

export const MUNI_DOCS: DocSpec[] = [
  { key: "nomina", label: "Atto di nomina / delibera", hint: "Delibera o determina che autorizza l'adesione", required: true, match: ["nomina", "delibera", "determina", "atto"] },
  { key: "identita", label: "Documento del referente", hint: "Carta d'identità del responsabile del progetto", required: true, match: ["identita", "identità", "carta", "passaporto", "cie", "documento"] },
  { key: "protocollo", label: "Protocollo o PEC di richiesta", hint: "Comunicazione ufficiale dell'ente", required: true, match: ["protocollo", "pec", "richiesta"] },
  { key: "iban", label: "IBAN di tesoreria", hint: "Coordinate della tesoreria comunale", required: true, match: ["iban", "tesoreria", "banca", "conto"] },
];

export function docSpecs(kind: string): DocSpec[] {
  return kind === "municipality" ? MUNI_DOCS : COMPANY_DOCS;
}

export function normalizeDocName(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export type UploadedDoc = {
  name: string;
  path: string;
  size?: number;
  content_type?: string;
  doc_key?: string;
};
