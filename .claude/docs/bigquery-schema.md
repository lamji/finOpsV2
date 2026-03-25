# BigQuery Billing Row — Real Schema

Captured from `GET /api/bigquery` (live GCP billing export table).

## Key Fields Used by the Aggregator

| Field | Type | Notes |
|-------|------|-------|
| `service.description` | string | GCP service name — used for category mapping |
| `sku.description` | string | Specific SKU within the service |
| `cost` | string | Scientific notation (e.g. `"5.28E-4"`) — always `parseFloat()` |
| `currency` | string | Always `"USD"` in this project |
| `invoice.month` | string | `"YYYYMM"` format (e.g. `"202508"` = Aug 2025) |
| `usage_start_time` | string | Unix timestamp as scientific notation string |
| `usage_end_time` | string | Unix timestamp as scientific notation string |
| `credits[].amount` | string | Negative values — subtract from `cost` for effective cost |
| `cost_type` | string | `"regular"`, `"tax"`, `"adjustment"`, etc. |
| `project.id` | string | GCP project ID |
| `location.region` | string | GCP region (e.g. `"me-central1"`) |

## Effective Cost Formula

```ts
effectiveCost = parseFloat(row.cost) + row.credits.reduce((sum, c) => sum + parseFloat(c.amount), 0)
// credits are negative — this subtracts them
```

## Full Row Shape

```json
{
  "billing_account_id": "01F185-0AA423-C9BA8A",
  "service": {
    "id": "EE2F-D110-890C",
    "description": "Cloud Key Management Service (KMS)"
  },
  "sku": {
    "id": "E09C-32B3-9AC7",
    "description": "Active software symmetric key versions"
  },
  "usage_start_time": "1.7566668E9",
  "usage_end_time": "1.7566704E9",
  "project": {
    "id": "lithe-sonar-431106-j2",
    "number": "8179510567",
    "name": "DF-SANDBOX",
    "labels": [],
    "ancestry_numbers": "/136670209087/",
    "ancestors": []
  },
  "location": {
    "location": "me-central1",
    "country": "QA",
    "region": "me-central1",
    "zone": null
  },
  "price": {
    "effective_price": "0.06",
    "tier_start_amount": "0",
    "unit": "month",
    "pricing_unit_quantity": "1",
    "list_price": "0.06",
    "effective_price_default": "0.06",
    "list_price_consumption_model": "0.06"
  },
  "cost": "5.28E-4",
  "currency": "USD",
  "currency_conversion_rate": "1.0",
  "usage": {
    "amount": "23584.0",
    "unit": "seconds",
    "amount_in_pricing_units": "0.008805256",
    "pricing_unit": "month"
  },
  "credits": [],
  "invoice": {
    "month": "202508",
    "publisher_type": "GOOGLE"
  },
  "cost_type": "regular",
  "adjustment_info": {
    "id": null,
    "description": null,
    "mode": null,
    "type": null
  },
  "cost_at_list": "5.28E-4",
  "cost_at_effective_price_default": "5.28E-4",
  "cost_at_list_consumption_model": "5.28E-4",
  "consumption_model": {
    "id": "7754-699E-0EBF",
    "description": "Default"
  }
}
```

## invoice.month Seen in Data

- `"202508"` — August 2025
- `"202509"` — September 2025

## Service → Category Mapping (used in aggregator)

| GCP Service Description | FinOps Category |
|------------------------|-----------------|
| Compute Engine, GKE, Cloud Run, App Engine, Cloud Functions | Compute |
| Cloud Storage, Cloud SQL, Cloud Bigtable, Cloud Spanner, Filestore | Storage |
| Networking, Cloud CDN, Cloud DNS, Cloud Interconnect, Cloud VPN | Network & Data Transfer |
| Cloud KMS, Pub/Sub, BigQuery, Cloud Monitoring, Cloud Logging | Third-party Services |
| Everything else | Other |
