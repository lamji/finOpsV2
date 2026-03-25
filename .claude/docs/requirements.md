# Technical Assignment

Full Stack Developer

Feb 2026

---

## 1. FinOps Intelligence Dashboard

### Project Objective

Design, develop, and deploy a production-grade FinOps Intelligence Tool. The
application must interface with a live Google Cloud BigQuery billing dataset to
transform raw cloud spend into actionable business insights using AI

### Technical Requirements

#### 1. Data Integration & FinOps Engine

- Cloud Source: Authenticate and query the provided Google Cloud BigQuery
  billing export.
- Core Logic: Implementation of multi-dimensional cost aggregation (by
  Service, Project, SKU, and Time-period).
- AI Integration: Leverage an LLM to generate automated spend summaries,
  detect anomalies, or provide cost-optimization recommendations based on
  real-time data.

#### 2. The Dashboard (Functional Deliverable)

A fully functional web interface is required. The dashboard must provide:

- High-level financial overviews (MTD spend, burn rates).
- Granular drill-downs into cost drivers.
- An interactive AI-driven insight panel.

#### 3. Software Development Lifecycle (SDLC) & Environment Strategy

The solution must be architected to support a standard enterprise release cycle.
This includes:

- Environment Isolation: Distinct configurations and deployments for
  Development, Staging, and Production tiers.
- Secrets Management: Secure handling of the provided Service Account and
  API keys across all environments.
- Promotion Workflow: A documented process for moving code from
  development to a live production state.
- Production Standards: Implementation of structured logging, error
  handling, and performance optimization (caching/query efficiency).

---

### Technical Stack

- Frontend: Modern framework (React/Next.js preferred).
- Backend: Node.js, Python (FastAPI/Flask).
- Storage: A database is preferred (PostgreSQL/DuckDB), but a
  well-structured in-memory or file-based system is acceptable if the design
  pattern is solid.
- AI/LLM: Integration with an LLM provider (e.g., OpenAI, Vertex AI, or
  Anthropic).
- Infrastructure: Containerized environment (Docker) for consistent
  deployment across environments.

### Mandatory Deliverables

1. Source Code: Access to a Git repository.
2. Live Access: A URL to the Production deployment.
3. Technical Brief (README.md):
   - Detailed setup and local execution steps.
   - Architecture & SDLC Overview: A technical explanation of how the
     application is structured and how the Dev/Staging/Prod lifecycle is
     managed.
   - AI Disclosure: Documentation of AI tools used for development and
     their role within the application.
   - Engineering Roadmap: A brief analysis of how this architecture would
     evolve to handle massive data volumes or stricter compliance
     requirements.