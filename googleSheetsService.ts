
import { Takeaway } from './types';

// These should be configured in your environment
// Google Sheets Service with Service Account
// Note: Using Service Account in the browser is generally not recommended for public apps due to key exposure.
// However, for this local/personal tool, we will implement it using Web Crypto API.

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || '';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let accessToken: string | null = null;
let tokenExpiry: number = 0;

export const googleSheetsService = {
  /**
   * Helper to convert PEM to binary
   */
  async importPrivateKey(pem: string): Promise<CryptoKey> {
    // clean up the PEM string
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    // Handle both "\n" literals and actual newlines
    let pemContents = pem;
    if (pemContents.startsWith('"') && pemContents.endsWith('"')) {
      pemContents = pemContents.slice(1, -1);
    }
    pemContents = pemContents.replace(/\\n/g, ''); // Remove literal \n
    pemContents = pemContents.replace(/\n/g, '');   // Remove actual newlines
    pemContents = pemContents.replace(pemHeader, '').replace(pemFooter, '');

    // Base64 decode
    const binaryDerString = window.atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    return window.crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );
  },

  /**
   * Generate a JWT for the Service Account
   */
  async createJWT(): Promise<string> {
    const header = {
      alg: "RS256",
      typ: "JWT"
    };

    const now = Math.floor(Date.now() / 1000);
    const claimSet = {
      iss: CLIENT_EMAIL,
      scope: SCOPES.join(' '),
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    };

    const encodedHeader = btoa(JSON.stringify(header));
    const encodedClaimSet = btoa(JSON.stringify(claimSet));

    const unsignedToken = `${encodedHeader}.${encodedClaimSet}`;

    const key = await this.importPrivateKey(PRIVATE_KEY);
    const signature = await window.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsignedToken)
    );

    // Convert signature to base64url equivalent (approximate using btoa)
    // Actually, JWT uses Base64URL, not standard Base64.
    // We need to replace + with -, / with _, and remove =.
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return `${unsignedToken.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.${base64Signature}`;
  },

  /**
   * Request an access token using the Service Account (JWT Flow)
   */
  async getAuthToken(): Promise<string> {
    if (accessToken && Date.now() < tokenExpiry) return accessToken;

    try {
      const jwt = await this.createJWT();

      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      accessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Buffer of 1m
      return accessToken as string;
    } catch (err) {
      console.error("Auth Error:", err);
      throw err;
    }
  },

  /**
   * Get the Sheet ID (numeric) for the first sheet
   */
  /**
   * Get the Sheet ID (numeric) and Title for the first sheet
   */
  async getSheetMeta(token: string): Promise<{ id: number; title: string }> {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!response.ok) throw new Error("Failed to fetch spreadsheet metadata");

    const data = await response.json();
    // Default to the first sheet
    const props = data.sheets[0].properties;
    return { id: props.sheetId, title: props.title };
  },

  /**
   * Check the background color of the last row
   */
  async getLastRowColor(token: string, sheetTitle: string): Promise<'ORANGE' | 'GREEN' | null> {
    // Escape title for A1 notation if needed (simple quote wrap)
    const rangeTitle = `'${sheetTitle.replace(/'/g, "''")}'`;

    // 1. Get the last row index
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${rangeTitle}!A:A`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await response.json();
    const values = data.values || [];
    const lastRowIndex = values.length; // 1-based, or 0 if empty

    if (lastRowIndex === 0) return null; // Sheet is empty

    // 2. Fetch the format of the last cell in column A
    const formatResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?ranges=${rangeTitle}!A${lastRowIndex}&fields=sheets.data.rowData.values.userEnteredFormat.backgroundColor&includeGridData=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const formatData = await formatResponse.json();
    const rowData = formatData.sheets?.[0]?.data?.[0]?.rowData?.[0];
    const color = rowData?.values?.[0]?.userEnteredFormat?.backgroundColor;

    if (!color) return null;

    // Compare with approximate values
    const isOrange = (c: any) => c.red > 0.9 && c.green > 0.75 && c.blue > 0.55 && c.blue < 0.65;
    const isGreen = (c: any) => c.red > 0.5 && c.red < 0.65 && c.green > 0.7 && c.blue < 0.55;

    if (isOrange(color)) return 'ORANGE';
    if (isGreen(color)) return 'GREEN';

    return null;
  },

  /**
   * Append takeaways to the actual Google Sheet with formatting
   */
  async syncToSheet(takeaways: Takeaway[]): Promise<boolean> {
    if (!CLIENT_EMAIL || !PRIVATE_KEY || !SHEET_ID) {
      console.error("Google Client Email, Private Key, or Sheet ID missing in environment variables.");
      return false;
    }

    try {
      const token = await this.getAuthToken();

      // 1. Get Sheet Metadata (ID and Title)
      const meta = await this.getSheetMeta(token);

      // 2. Get Last Row Color using dynamic title
      const lastColor = await this.getLastRowColor(token, meta.title);

      // 3. Determine New Color sequence
      // Start with Orange if last was Green or Null (e.g. header or empty)
      // Start with Green if last was Orange
      let nextColorIsOrange = lastColor !== 'ORANGE';

      const ORANGE_BG = { red: 0.976, green: 0.796, blue: 0.612 };
      const GREEN_BG = { red: 0.576, green: 0.769, blue: 0.490 };

      // Prepare requests for batchUpdate
      const requests = [];

      for (const t of takeaways) {
        const color = nextColorIsOrange ? ORANGE_BG : GREEN_BG;

        const values = [
          { userEnteredValue: { stringValue: t.problemTitle } },
          { userEnteredValue: { stringValue: t.notes } },
          { userEnteredValue: { stringValue: t.concept } },
          { userEnteredValue: { stringValue: t.link } },
          { userEnteredValue: { stringValue: t.category } },
          { userEnteredValue: { stringValue: '⭐'.repeat(t.importance) } }
        ];

        const cells = values.map(v => ({
          ...v,
          userEnteredFormat: {
            backgroundColor: color
          }
        }));

        requests.push({
          appendCells: {
            sheetId: meta.id,
            rows: [{ values: cells }],
            fields: "userEnteredValue,userEnteredFormat.backgroundColor"
          }
        });

        // Toggle for next row
        nextColorIsOrange = !nextColorIsOrange;
      }

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: requests
          })
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Failed to append rows");
      }

      return true;
    } catch (error) {
      console.error("Google Sheets Sync Error:", error);
      throw error;
    }
  }
};
