# Bitespeed Identity Reconciliation

## Live Endpoint

```
POST https://<your-render-url>/identify
```

## Setup Locally

```bash
npm install
npm run dev
```

## API Usage

```
POST /identify
Content-Type: application/json
```

```json
{
  "email": "example@email.com",
  "phoneNumber": "123456"
}
```

## Response Format

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary@email.com", "secondary@email.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```
