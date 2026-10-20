# Architecture rules
- Bulk bank submission uses the existing refund status API, with separate CSV parsing/validation and wizard presentation, to preserve the individual bank-trigger behavior without directly invoking n8n.
- Bulk status writes are sequential and stop on uncertain failures without automatic retries, because the API response does not confirm n8n completion.