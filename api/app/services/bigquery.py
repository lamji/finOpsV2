import logging
from datetime import datetime

from google.cloud import bigquery
from google.oauth2 import service_account

from app.config import settings
from app.models import ServiceCostRow

logger = logging.getLogger(__name__)

# Whether to subtract GCP credits from cost when calculating effective_cost.
# Set to False to match TS route behaviour (cost only, no credit deduction).
# Flip to True if you want net cost after credits applied.
_INCLUDE_CREDITS = False


def _normalize_private_key(raw_key: str) -> str:

    # ── Step 1 — Strip surrounding whitespace ─────────────────────────────
    # Remove leading/trailing spaces or newlines added during copy-paste or
    # env file formatting before any other processing.
    normalized = raw_key.strip()

    # ── Step 2 — Strip surrounding quotes ────────────────────────────────
    # The key may be wrapped in single or double quotes in the env file.
    # e.g. GCP_PRIVATE_KEY='-----BEGIN...' or GCP_PRIVATE_KEY="-----BEGIN..."
    # Only strip if both ends match the same quote character.
    if (
        len(normalized) >= 2
        and normalized[0] == normalized[-1]
        and normalized[0] in {"'", '"'}
    ):
        normalized = normalized[1:-1]

    # ── Step 3 — Replace escaped newlines with real newlines ──────────────
    # Keys stored in JSON files or copied from GCP console often have literal
    # backslash-n sequences instead of real newline characters.
    # e.g. "-----BEGIN PRIVATE KEY-----\\nMIIE..." → actual line breaks.
    # Both \\r\\n (Windows JSON) and \\n (Unix JSON) are handled.
    normalized = normalized.replace("\\r\\n", "\n").replace("\\n", "\n")

    # ── Step 4 — Normalise Windows line endings to Unix ───────────────────
    # google-auth-library RSA parser requires Unix LF (\n) only.
    # Replace Windows CRLF (\r\n) and bare CR (\r) with \n, then strip again.
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n").strip()

    # ── Step 5 — Validate PEM header and footer ───────────────────────────
    # If either PEM boundary is missing after all normalisation, raise
    # ValueError immediately with a clear message — surfaces the real problem
    # instead of letting google-auth throw a cryptic MalformedError later.
    if "-----BEGIN PRIVATE KEY-----" not in normalized:
        raise ValueError("GCP_PRIVATE_KEY is missing a valid PEM header")

    if "-----END PRIVATE KEY-----" not in normalized:
        raise ValueError("GCP_PRIVATE_KEY is missing a valid PEM footer")

    # ── Step 6 — Ensure trailing newline ─────────────────────────────────
    # Some versions of google-auth-library's RSA parser require the PEM block
    # to end with a newline character. Append one unconditionally.
    return f"{normalized}\n"


def _get_client() -> bigquery.Client:

    # ── Step 1 — Assemble service account credentials dict ────────────────
    # Builds the credentials object from env vars (settings):
    #   type:         always "service_account" — tells google-auth which OAuth flow to use
    #   project_id:   GCP project that owns the billing export table
    #   private_key:  RSA private key from the downloaded JSON key file,
    #                 normalised via _normalize_private_key() to fix encoding issues
    #   client_email: service account email used to sign the JWT assertion
    #   token_uri:    OAuth2 endpoint that exchanges the signed JWT for a bearer token
    #
    # ── Step 2 — Create scoped credentials ───────────────────────────────
    # from_service_account_info() parses and validates the PEM private key,
    # then scopes the credentials to BigQuery read access only.
    # Raises google.auth.exceptions.MalformedError if the key is invalid.
    #
    # ── Step 3 — Return authenticated BigQuery client ─────────────────────
    # bigquery.Client lazily obtains an OAuth bearer token on the first API call
    # and auto-refreshes it before expiry — no manual token management needed.
    credentials = service_account.Credentials.from_service_account_info(
        {
            "type": "service_account",
            "project_id": settings.GCP_PROJECT_ID,
            "private_key": _normalize_private_key(settings.GCP_PRIVATE_KEY),
            "client_email": settings.GCP_CLIENT_EMAIL,
            "token_uri": "https://oauth2.googleapis.com/token",
        },
        scopes=["https://www.googleapis.com/auth/bigquery"],
    )
    return bigquery.Client(project=settings.GCP_PROJECT_ID, credentials=credentials)


def fetch_rows() -> list[ServiceCostRow]:

    # ── Step 1 — Resolve table reference and current year ─────────────────
    # current_year: used in the WHERE filter to scope results to this year only.
    # table: fully-qualified BigQuery table path in backtick notation required
    # by standard SQL — format: `project_id.dataset.table`
    current_year = datetime.now().year
    table = f"`{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.{settings.BQ_TABLE}`"

    # ── Step 2 — Build cost expression ────────────────────────────────────
    # Controlled by _INCLUDE_CREDITS flag at the top of the file.
    # False (default): uses raw `cost` column — gross spend before any credits.
    # True: adds credit amounts via UNNEST(credits) subquery. Credits are
    # negative values in GCP billing export, so SUM effectively subtracts them,
    # giving net effective spend after discounts/promotions.
    cost_expr = (
        "cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)"
        if _INCLUDE_CREDITS
        else "cost"
    )

    # ── Step 3 — Build SQL query ──────────────────────────────────────────
    # SELECT: 5 dimensions + SUM(cost_expr) as effective_cost
    #   invoice.month        → YYYYMM billing period  e.g. "202509"
    #   service.description  → GCP service name  e.g. "Cloud Storage"
    #   project.name         → human-readable project name  e.g. "DF-SANDBOX"
    #   project.id           → project ID (fallback when project.name is null)
    #   sku.description      → specific SKU  e.g. "Standard Storage US"
    #
    # WHERE invoice.month LIKE '{current_year}%':
    #   Filters to the current calendar year only (e.g. "2026%").
    #   Avoids pulling years of historical data — keeps bytes-billed low.
    #
    # GROUP BY 1, 2, 3, 4, 5:
    #   Collapses many individual line items into one row per unique
    #   (month, service, project, sku) combination — reduces rows from
    #   thousands to hundreds, making aggregate() faster and payload smaller.
    query = f"""
        SELECT
            invoice.month        AS invoice_month,
            service.description  AS service_description,
            project.name         AS project_name,
            project.id           AS project_id,
            sku.description      AS sku_description,
            SUM({cost_expr})     AS effective_cost
        FROM {table}
        WHERE invoice.month LIKE '{current_year}%'
        GROUP BY 1, 2, 3, 4, 5
    """

    # ── Step 4 — Execute query ────────────────────────────────────────────
    # _get_client() builds an authenticated BigQuery client from env credentials.
    # client.query(query) submits the job to BigQuery asynchronously.
    # .result() blocks until the job completes and returns a RowIterator.
    # Raises google.cloud.exceptions.GoogleCloudError on job failure.
    logger.info(f"Fetching BigQuery rows for year {current_year}")
    client = _get_client()
    results = client.query(query).result()

    # ── Step 5 — Map results to ServiceCostRow models ─────────────────────
    # Each BigQuery result row is mapped to a ServiceCostRow Pydantic model.
    # Fallback rules per field:
    #   invoice_month:       or "" — engine.py filters out blank months in Step 1
    #   service_description: or "" — engine.py labels blank as "Unknown"
    #   project_name:        None allowed — engine.py falls back to project_id
    #   project_id:          None allowed — engine.py labels None as "Unknown"
    #   sku_description:     None allowed — engine.py labels None as "Unknown"
    #   effective_cost:      or 0.0 — prevents None in float arithmetic in engine.py
    rows = [
        ServiceCostRow(
            invoice_month=row.invoice_month or "",
            service_description=row.service_description or "",
            project_name=row.project_name,
            project_id=row.project_id,
            sku_description=row.sku_description,
            effective_cost=float(row.effective_cost or 0),
        )
        for row in results
    ]

    logger.info(f"Fetched {len(rows)} rows from BigQuery")
    return rows
