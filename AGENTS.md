# Architecture rules
- Dashboard Call Center KPIs and chart share the first-management selector in callCenterMetrics so historical re-gestions cannot diverge across metrics.
- Call Center insurance breakdown uses exclusive snapshot-type groups, retaining mixed and unknown groups separately to preserve overall counts and stored premiums without speculative allocation.
- Bulk bank submission uses the existing refund status API and separate CSV rules/wizard, keeping document prerequisites but no AI validation dependencies, to preserve the bank trigger without affecting individual validation.
- Bulk status writes are sequential and stop on uncertain failures without automatic retries, because the API response does not confirm n8n completion.