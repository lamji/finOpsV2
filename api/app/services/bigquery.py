import logging
from datetime import datetime

from google.cloud import bigquery
from google.oauth2 import service_account

from app.config import settings
from app.models import ServiceCostRow

logger = logging.getLogger(__name__)

# Matches TS route: const inCludeCredits = false
_INCLUDE_CREDITS = False


def _normalize_private_key(raw_key: str) -> str:
    normalized = raw_key.strip()

    if (
        len(normalized) >= 2
        and normalized[0] == normalized[-1]
        and normalized[0] in {"'", '"'}
    ):
        normalized = normalized[1:-1]

    normalized = normalized.replace("\\r\\n", "\n").replace("\\n", "\n")
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n").strip()

    if "-----BEGIN PRIVATE KEY-----" not in normalized:
        raise ValueError("GCP_PRIVATE_KEY is missing a valid PEM header")

    if "-----END PRIVATE KEY-----" not in normalized:
        raise ValueError("GCP_PRIVATE_KEY is missing a valid PEM footer")

    return f"{normalized}\n"


def _get_client() -> bigquery.Client:
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
    current_year = datetime.now().year
    table = f"`{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.{settings.BQ_TABLE}`"

    cost_expr = (
        "cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)"
        if _INCLUDE_CREDITS
        else "cost"
    )

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

    logger.info(f"Fetching BigQuery rows for year {current_year}")
    client = _get_client()
    results = client.query(query).result()

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
