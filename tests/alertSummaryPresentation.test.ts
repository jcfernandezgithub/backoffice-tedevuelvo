import { describe, expect, test } from 'bun:test'
import { alertTypeDistribution } from '../src/lib/alertSummaryPresentation'

describe('Distribution over filtered open cases', () => {
  test('uses all open cases, not pending cases or the current page', () => {
    const rows = alertTypeDistribution({totals:{open:80,pending:25,inReview:55,resolved:20},byRule:[
      {ruleCode:'SAME_ACCOUNT_MULTIPLE_RUTS',open:20},
      {ruleCode:'SAME_RUT_MONTHLY_PAID_VOLUME',open:60},
    ]})
    expect(rows[0].percentage).toBe(75)
    expect(rows[1].percentage).toBe(25)
    expect(rows[0].ruleCode).toBe('SAME_RUT_MONTHLY_PAID_VOLUME')
  })
  test('an empty cut has zero percentages', () => {
    expect(alertTypeDistribution({totals:{open:0,pending:0,inReview:0,resolved:4},byRule:[
      {ruleCode:'SAME_RUT_MONTHLY_PAID_VOLUME',open:0},
    ]})[0].percentage).toBe(0)
  })
})