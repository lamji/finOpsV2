SELECT
  invoice.month AS invoice_month,
  service.description AS service_description,
  project.name AS project_name,
  project.id AS project_id,
  sku.description AS sku_description,
  SUM(cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS effective_cost
FROM `lithe-sonar-431106-j2.finopsDS.gcp_billing_export_resource_v1_01F185_0AA423_C9BA8A`
WHERE invoice.month = '202603'
GROUP BY 1, 2, 3, 4, 5
ORDER BY effective_cost DESC
