# Brightloop Subscription Management System --- Functional Test Checklist

> **Purpose:** This document lists the expected functionality to verify
> for each user role and the shared workflows of the Subscription
> Management System.
>
> **Source basis:** The requirements in the supplied *Subscription
> Management System* brief for Brightloop Software.
>
> **Important scope note:** The brief explicitly defines three access
> groups: **Admin**, **Internal Staff**, and **Customer**. It states
> that the admin controls the system, staff handle day-to-day work with
> limited access, and customers can access only their own subscriptions
> and invoices through a portal. Where the brief does not specify an
> exact permission or workflow, this checklist marks it as **Confirm
> with product owner** rather than treating an assumption as a confirmed
> requirement.

## How to use this checklist

-   [ ] Mark an item complete only after testing it successfully.
-   [ ] Record defects against the relevant item.
-   [ ] Test both valid and invalid inputs where applicable.
-   [ ] Test access control using separate accounts for each role.
-   [ ] Use realistic test data, including multiple customers,
    subscriptions, invoices, and payments.

------------------------------------------------------------------------

# 1. Role and Access Expectations

## 1.1 Admin

The Admin has control over the system. The brief explicitly assigns the
following capabilities to the admin:

-   [ ] Create and manage products.
-   [ ] Configure product details, including name, type, sales price,
    cost price, and notes.
-   [ ] Create and manage product variants and their additional prices.
-   [ ] Create and configure subscription plans.
-   [ ] Configure plan billing frequency: daily, weekly, monthly, or
    yearly.
-   [ ] Configure plan minimum quantity.
-   [ ] Configure plan availability dates.
-   [ ] Decide whether a plan closes automatically when it ends.
-   [ ] Decide whether subscriptions under a plan can be closed early.
-   [ ] Decide whether subscriptions under a plan can be paused.
-   [ ] Decide whether subscriptions under a plan can be renewed.
-   [ ] Create discount rules.
-   [ ] Configure fixed-amount discounts.
-   [ ] Configure percentage discounts.
-   [ ] Configure discount minimum purchase amount or minimum quantity.
-   [ ] Configure discount start and end dates.
-   [ ] Configure discount usage limits.
-   [ ] Configure which products or subscriptions a discount applies to.
-   [ ] Add new internal staff members. Only the admin may add staff.
-   [ ] Control access so internal staff have limited permissions and
    customers see only their own subscriptions and invoices.

**Admin permissions that need product-owner confirmation:**

-   [ ] Confirm whether the admin can create, edit, deactivate, and
    delete internal staff accounts, or only add them.
-   [ ] Confirm whether the admin can create customer accounts manually.
-   [ ] Confirm whether the admin can create, edit, send, print,
    confirm, cancel, or mark invoices as paid.
-   [ ] Confirm whether the admin can record payments and correct
    payment records.
-   [ ] Confirm whether the admin can create quotations and
    subscriptions directly.
-   [ ] Confirm whether the admin can configure tax rules. The brief
    requires taxes to be calculated automatically from rules set by the
    admin, but does not define the full tax-rule management interface.
-   [ ] Confirm whether the admin has access to all dashboard and
    reporting filters.
-   [ ] Confirm whether the admin can override subscription status
    transitions.

## 1.2 Internal Staff

The brief states that internal staff handle day-to-day work with limited
access. The following are day-to-day operations described in the brief
and are therefore expected staff workflows, subject to the precise
permission matrix being confirmed.

-   [ ] Access the system using an authorized staff account.
-   [ ] View customer information needed for day-to-day work.
-   [ ] Prepare a quotation for a customer.
-   [ ] Start a quotation from an existing quotation template.
-   [ ] Use the template's predefined plan and product lines.
-   [ ] See the quotation's validity period.
-   [ ] View a subscription's number, customer, plan, start date, expiry
    date, payment terms, and product lines.
-   [ ] View the current subscription status.
-   [ ] Handle day-to-day subscription records within assigned
    permissions.
-   [ ] View invoices generated from subscriptions.
-   [ ] Confirm invoices, where permitted.
-   [ ] Send invoices, where permitted.
-   [ ] Print invoices, where permitted.
-   [ ] Cancel invoices, where permitted.
-   [ ] Record payments against the correct invoice, where permitted.
-   [ ] View which invoices are paid.
-   [ ] View which invoices remain outstanding.
-   [ ] Identify overdue invoices for follow-up.
-   [ ] Access only the functions and records allowed by the staff
    permission level.

**Staff permissions that need product-owner confirmation:**

-   [ ] Confirm whether staff can create or edit customers.
-   [ ] Confirm whether staff can create or edit products and plans.
-   [ ] Confirm whether staff can create or edit quotation templates.
-   [ ] Confirm which subscription status changes staff can perform.
-   [ ] Confirm whether staff can pause, renew, or close subscriptions.
-   [ ] Confirm whether staff can apply an existing discount or only
    view automatically applied discounts.
-   [ ] Confirm whether staff can create or change tax rules.
-   [ ] Confirm whether staff can record, edit, reverse, or delete
    payments.
-   [ ] Confirm whether staff can access revenue reports and which
    figures they may see.
-   [ ] Confirm whether staff can invite or create other staff members.
    The brief explicitly reserves adding staff to the admin.

## 1.3 Customer

Customers use a portal and must see only their own subscriptions and
invoices.

-   [ ] Register an account using an email address and password.
-   [ ] Be prevented from registering another account using an email
    address already in use.
-   [ ] Be required to use a password longer than eight characters.
-   [ ] Be required to include an uppercase letter, a lowercase letter,
    and a special character in the password.
-   [ ] Log in using valid credentials.
-   [ ] Be prevented from logging in with invalid credentials.
-   [ ] Request a password reset.
-   [ ] Receive a password-reset link at the registered email address.
-   [ ] Use a valid reset link to reset the password.
-   [ ] Be informed when a reset link is invalid or expired.
-   [ ] Access the customer portal after authentication.
-   [ ] View their own subscription records.
-   [ ] View the status of their own subscriptions.
-   [ ] View their own invoices.
-   [ ] Never view another customer's subscriptions or invoices.
-   [ ] Be prevented from accessing admin-only functions.
-   [ ] Be prevented from accessing staff-only functions.
-   [ ] See accurate invoice details, including product lines, taxes,
    and totals, where displayed in the portal.

**Customer actions that need product-owner confirmation:**

-   [ ] Confirm whether customers can choose and purchase plans directly
    in the portal.
-   [ ] Confirm whether customers can accept or reject quotations in the
    portal.
-   [ ] Confirm whether customers can request a pause, early closure, or
    renewal.
-   [ ] Confirm whether customers can make online payments, or whether
    payments are only recorded by staff.
-   [ ] Confirm whether customers can update profile/contact
    information.
-   [ ] Confirm whether customers can download or print invoices. The
    brief explicitly requires customers to see their invoices, but does
    not specify download or print functionality.

------------------------------------------------------------------------

# 2. Authentication and Account Tests

## 2.1 Registration

-   [ ] A visitor can create an account using an email address and
    password.
-   [ ] Registration succeeds with a valid, unused email address and a
    valid password.
-   [ ] Registration is rejected when the email address is already
    associated with an account.
-   [ ] Email uniqueness is enforced even if letter casing differs,
    according to the chosen email normalization rule.
-   [ ] Registration is rejected when the password is eight characters
    or fewer.
-   [ ] Registration is rejected when the password has no uppercase
    letter.
-   [ ] Registration is rejected when the password has no lowercase
    letter.
-   [ ] Registration is rejected when the password has no special
    character.
-   [ ] Required-field validation is displayed.
-   [ ] Passwords are not displayed in plain text after submission or
    stored as plain text.

## 2.2 Login and role access

-   [ ] A registered user can log in with valid credentials.
-   [ ] Invalid credentials do not grant access.
-   [ ] A logged-out user cannot access protected pages by entering
    their URL directly.
-   [ ] Admin accounts are routed to the admin experience.
-   [ ] Staff accounts are routed to the staff experience.
-   [ ] Customer accounts are routed to the customer portal.
-   [ ] A user cannot gain another role's permissions by changing a URL,
    request, or browser-side value.
-   [ ] Logging out ends the authenticated session.

## 2.3 Password reset

-   [ ] A user can request a password-reset link using their registered
    email.
-   [ ] The reset link is sent to the registered email address.
-   [ ] A valid reset link allows the user to set a new password.
-   [ ] The new password follows the password rules.
-   [ ] An expired or invalid reset link cannot be used.
-   [ ] A used reset link cannot be reused.
-   [ ] The user can log in with the new password after a successful
    reset.

------------------------------------------------------------------------

# 3. Product Management Tests --- Admin

## 3.1 Product creation and editing

-   [ ] Admin can add a product.
-   [ ] Product can store a name.
-   [ ] Product can store a type.
-   [ ] Product can store a sales price.
-   [ ] Product can store a cost price.
-   [ ] Product can store notes.
-   [ ] Required product fields are validated.
-   [ ] Invalid or negative prices are rejected unless explicitly
    allowed by business rules.
-   [ ] Admin can view product details.
-   [ ] Admin can edit product details.
-   [ ] Updated product details are reflected wherever the product is
    used, without changing historical invoice values.
-   [ ] Admin can find products in the product list.

## 3.2 Product variants and pricing

-   [ ] Admin can add a variant to a product.
-   [ ] Admin can define the variant's identifying value, such as a
    brand.
-   [ ] Admin can define the additional price for a variant.
-   [ ] Selecting a variant adds its configured additional price to the
    base product price.
-   [ ] Example: a product priced at 2,000 with an Odoo variant
    surcharge of 560 is calculated as 2,560.
-   [ ] Changing the selected variant updates the calculated product
    price.
-   [ ] A variant's additional price is not added more than once.
-   [ ] Variant pricing is reflected in the relevant quotation,
    subscription, and invoice calculations.

------------------------------------------------------------------------

# 4. Subscription Plan Management Tests --- Admin

-   [ ] Admin can create a plan.
-   [ ] Admin can associate a plan with a product.
-   [ ] Admin can set the plan price.
-   [ ] Admin can select daily billing.
-   [ ] Admin can select weekly billing.
-   [ ] Admin can select monthly billing.
-   [ ] Admin can select yearly billing.
-   [ ] Admin can set a minimum quantity.
-   [ ] Admin can set the plan's availability start date.
-   [ ] Admin can set the plan's availability end date.
-   [ ] Admin can configure automatic closure when the plan ends.
-   [ ] Admin can configure whether early closure is permitted.
-   [ ] Admin can configure whether pausing is permitted.
-   [ ] Admin can configure whether renewal is permitted.
-   [ ] Plan configuration is saved correctly.
-   [ ] Invalid date ranges are rejected.
-   [ ] A plan is not offered outside its configured availability
    period.
-   [ ] Subscription actions respect the permissions configured for the
    plan.

------------------------------------------------------------------------

# 5. Quotation Template Tests

## 5.1 Template setup

-   [ ] An authorized user can access available quotation templates.
-   [ ] A quotation template can contain the intended plan.
-   [ ] A quotation template can contain product lines.
-   [ ] A quotation template has a configured validity duration.
-   [ ] A template can be reused for more than one quotation.
-   [ ] Changes to a template do not unexpectedly alter quotations
    already issued.

## 5.2 Creating a quotation from a template

-   [ ] Staff can start a quotation using a template.
-   [ ] The template's plan is populated in the quotation.
-   [ ] The template's product lines are populated in the quotation.
-   [ ] Product quantities and prices are populated correctly.
-   [ ] The quotation validity/expiry date is calculated from its
    creation date and configured validity duration.
-   [ ] The quotation is associated with the correct customer.
-   [ ] The quotation can be reviewed before it is issued.
-   [ ] An expired quotation is identified as expired or invalid for
    acceptance, according to the final workflow.

------------------------------------------------------------------------

# 6. Subscription Management Tests

## 6.1 Subscription creation and details

-   [ ] An authorized user can create a subscription.
-   [ ] Each subscription receives a unique subscription number.
-   [ ] A subscription is linked to the correct customer.
-   [ ] A subscription is linked to the correct plan.
-   [ ] A start date is stored.
-   [ ] An expiry date is stored.
-   [ ] Payment terms are stored.
-   [ ] One or more product lines can be added.
-   [ ] Each product line stores its product.
-   [ ] Each product line stores its quantity.
-   [ ] Each product line stores its unit price.
-   [ ] Applicable taxes are stored or calculated.
-   [ ] Line amounts and subscription totals are calculated correctly.
-   [ ] The subscription can be viewed by authorized team members.
-   [ ] A customer can view only their own subscription.

## 6.2 Subscription status lifecycle

-   [ ] A new subscription can be saved as Draft.
-   [ ] A Draft subscription can move to Quotation.
-   [ ] A Quotation can move to Confirmed.
-   [ ] A Confirmed subscription can move to Active.
-   [ ] An Active subscription can move to Closed.
-   [ ] The current status is visible to authorized users.
-   [ ] Invalid status transitions are rejected.
-   [ ] Status changes are reflected consistently in the subscription
    list and detail view.
-   [ ] A subscription is automatically closed when its configured plan
    rules require closure at the end date.
-   [ ] Early closure is allowed only when the plan permits it.
-   [ ] Pausing is allowed only when the plan permits it.
-   [ ] Renewal is allowed only when the plan permits it.

## 6.3 Subscription dates and renewal

-   [ ] Start and expiry dates are stored accurately.
-   [ ] Billing frequency is respected when calculating the next billing
    date.
-   [ ] Daily, weekly, monthly, and yearly billing schedules are
    handled.
-   [ ] Month-end and leap-year date cases are tested.
-   [ ] Renewal creates or extends the subscription according to the
    agreed renewal policy.
-   [ ] Closed subscriptions are not billed again unless renewed and
    made eligible under the business rules.

------------------------------------------------------------------------

# 7. Tax Calculation Tests

The brief requires taxes to be calculated automatically from rules
configured by the admin.

-   [ ] An invoice calculation uses the applicable tax rule.
-   [ ] Tax is calculated from the correct taxable amount.
-   [ ] Tax is calculated for each applicable product line.
-   [ ] Multiple applicable tax rules are handled according to the
    configured rule.
-   [ ] Invoice subtotal, tax total, and final total are consistent.
-   [ ] Tax values are visible in the invoice breakdown.
-   [ ] Rounding is consistent across line totals and invoice totals.
-   [ ] A change to a tax rule does not silently change an already
    issued historical invoice.

**Confirm with product owner:** The brief does not specify tax
categories, compound taxes, inclusive/exclusive pricing, jurisdiction
rules, or the exact tax administration screens. These must be defined
before detailed tax test cases can be finalized.

------------------------------------------------------------------------

# 8. Discount Management Tests --- Admin Configuration and Automatic Application

## 8.1 Discount rule creation

-   [ ] Admin can create a fixed-amount discount.
-   [ ] Admin can create a percentage discount.
-   [ ] Admin can set a minimum purchase amount.
-   [ ] Admin can set a minimum quantity.
-   [ ] Admin can set a start date.
-   [ ] Admin can set an end date.
-   [ ] Admin can set a maximum usage count.
-   [ ] Admin can specify eligible products.
-   [ ] Admin can specify whether the discount applies to selected
    products or an entire subscription.
-   [ ] Invalid discount values are rejected.
-   [ ] Discount rules are available only to authorized users for
    creation and editing.

## 8.2 Discount eligibility and application

-   [ ] An eligible fixed discount is applied correctly.
-   [ ] An eligible percentage discount is applied correctly.
-   [ ] A discount is not applied when the minimum purchase amount is
    not met.
-   [ ] A discount is not applied when the minimum quantity is not met.
-   [ ] A discount is not applied before its start date.
-   [ ] A discount is not applied after its end date.
-   [ ] A discount is not applied after its usage limit is reached.
-   [ ] A discount is applied only to eligible products or
    subscriptions.
-   [ ] The discount appears automatically on the next eligible invoice.
-   [ ] The invoice shows the discount amount and resulting total.
-   [ ] Discount usage is counted accurately.
-   [ ] Concurrent invoice generation cannot exceed the discount usage
    limit.

------------------------------------------------------------------------

# 9. Invoice and Recurring Billing Tests

## 9.1 Invoice generation

-   [ ] The system identifies subscriptions due for billing.
-   [ ] An invoice is generated from the relevant subscription.
-   [ ] The invoice contains the correct customer details.
-   [ ] The invoice contains the correct product lines.
-   [ ] Product quantities are copied correctly.
-   [ ] Unit prices are copied correctly.
-   [ ] Applicable taxes are calculated automatically.
-   [ ] Eligible discounts are applied automatically.
-   [ ] Subtotal and final total are calculated correctly.
-   [ ] Invoice number is unique.
-   [ ] Invoice date and due date are populated according to the
    configured rules.
-   [ ] The invoice is linked to the correct subscription.
-   [ ] The billing period covered by the invoice is identifiable.

## 9.2 Billing schedule and duplicate prevention

-   [ ] Daily subscriptions are invoiced when due.
-   [ ] Weekly subscriptions are invoiced when due.
-   [ ] Monthly subscriptions are invoiced when due.
-   [ ] Yearly subscriptions are invoiced when due.
-   [ ] A due subscription is not skipped by the billing process.
-   [ ] The same subscription is not invoiced twice for the same billing
    period.
-   [ ] Re-running the billing job does not create duplicate invoices.
-   [ ] Failed invoice generation can be identified and retried safely.
-   [ ] Closed or otherwise ineligible subscriptions are not billed.
-   [ ] The next billing date is advanced correctly after invoice
    generation.
-   [ ] Billing behavior around month-end, year-end, leap years, and
    time zones is tested.

## 9.3 Invoice operations and statuses

-   [ ] An invoice can be created in Draft status.
-   [ ] An invoice can be Confirmed.
-   [ ] An invoice can be sent.
-   [ ] An invoice can be printed.
-   [ ] An invoice can be cancelled according to the permitted workflow.
-   [ ] An invoice can become Paid when payment is complete.
-   [ ] Invalid invoice status transitions are rejected.
-   [ ] Invoice details remain consistent after confirmation.
-   [ ] An invoice cannot be accidentally billed or paid twice.
-   [ ] Outstanding and overdue invoices can be identified.

------------------------------------------------------------------------

# 10. Payment Management Tests

-   [ ] A payment can be recorded against an invoice.
-   [ ] A payment stores its method.
-   [ ] A payment stores its amount.
-   [ ] A payment stores its date.
-   [ ] A payment stores a note.
-   [ ] A payment is linked to the correct invoice.
-   [ ] The customer associated with the payment matches the invoice
    customer.
-   [ ] Payments arriving on different dates can be recorded.
-   [ ] Payments made using different methods can be recorded.
-   [ ] The paid amount is updated after a payment is recorded.
-   [ ] The outstanding amount is calculated correctly.
-   [ ] An invoice is marked Paid when the full amount has been
    received.
-   [ ] An invoice remains outstanding when the full amount has not been
    received.
-   [ ] Multiple payments against one invoice are handled correctly.
-   [ ] The team can list paid invoices.
-   [ ] The team can list outstanding invoices.
-   [ ] The team can identify overdue invoices for follow-up.
-   [ ] A payment is not accidentally linked to the wrong invoice.

**Confirm with product owner:** The brief does not define refunds,
payment gateways, payment failure handling, overpayments, payment
reversals, or automatic bank reconciliation. Do not assume these are
included without a decision.

------------------------------------------------------------------------

# 11. Customer Portal Tests

-   [ ] Customer can log in to the portal.
-   [ ] Customer can view their own subscriptions.
-   [ ] Customer can view subscription details.
-   [ ] Customer can see the status of each subscription.
-   [ ] Customer can view their own invoices.
-   [ ] Customer can see invoice amounts and relevant billing details.
-   [ ] Customer cannot view another customer's subscription by changing
    a URL or record ID.
-   [ ] Customer cannot view another customer's invoice by changing a
    URL or record ID.
-   [ ] Customer cannot call staff or admin APIs successfully.
-   [ ] Customer cannot access administrative configuration pages.
-   [ ] Customer cannot create staff accounts.
-   [ ] Customer sees clear messages when no subscriptions or invoices
    exist.

------------------------------------------------------------------------

# 12. Dashboard and Reporting Tests

The finance lead must be able to review the business without manually
compiling spreadsheets.

-   [ ] Dashboard displays the number of active subscriptions.
-   [ ] Dashboard displays revenue received.
-   [ ] Dashboard displays outstanding amounts.
-   [ ] Dashboard identifies overdue invoices.
-   [ ] Dashboard displays subscription information accurately.
-   [ ] Dashboard displays payment information accurately.
-   [ ] Dashboard data matches the underlying subscription, invoice, and
    payment records.
-   [ ] Users can apply available filters.
-   [ ] Date filters return records from the selected date range.
-   [ ] Customer filters return records for the selected customer.
-   [ ] Subscription filters return the correct subscription statuses.
-   [ ] Invoice filters return the correct invoice statuses.
-   [ ] Summary values update when filters change.
-   [ ] Reports can handle thousands of subscriptions without requiring
    manual spreadsheet work.

**Confirm with product owner:** The brief requires a summary view and
filters but does not prescribe exact chart types, export formats, or a
complete list of report metrics.

------------------------------------------------------------------------

# 13. Performance and Reliability Tests

-   [ ] Each page responds in under two seconds under the agreed test
    conditions.
-   [ ] Pages remain responsive with thousands of subscriptions.
-   [ ] Large invoice lists use efficient pagination or an equivalent
    approach.
-   [ ] Search and filters remain usable with large datasets.
-   [ ] Dashboard summaries do not require loading every record into the
    browser.
-   [ ] Concurrent billing requests do not generate duplicate invoices.
-   [ ] Concurrent payment updates do not corrupt invoice balances.
-   [ ] Failed operations do not leave partially saved business records.
-   [ ] Error messages are understandable and do not expose sensitive
    technical details.
-   [ ] Important operations preserve data consistency.

**Performance test note:** Define the test environment, dataset size,
and response-time measurement method before treating the two-second
target as a formal pass/fail benchmark.

------------------------------------------------------------------------

# 14. Cross-Role Access-Control Tests

Use separate Admin, Internal Staff, and Customer test accounts.

-   [ ] Admin can access admin-controlled product and plan
    configuration.
-   [ ] Internal Staff cannot access restricted admin-only
    configuration.
-   [ ] Customer cannot access admin or staff areas.
-   [ ] Only Admin can add an internal staff member.
-   [ ] Staff can perform only the day-to-day operations allowed by
    their assigned permissions.
-   [ ] Customer can see only their own subscriptions.
-   [ ] Customer can see only their own invoices.
-   [ ] A customer cannot retrieve another customer's data through
    direct API requests.
-   [ ] A staff member cannot perform an admin-only operation by
    directly calling its API.
-   [ ] Hiding a button in the frontend is not the only protection;
    backend authorization is enforced.
-   [ ] Unauthorized requests return an appropriate access-denied
    response.

------------------------------------------------------------------------

# 15. End-to-End Business Workflow Tests

## Workflow A: New customer registration

-   [ ] Customer registers with a unique email and valid password.
-   [ ] Customer can log in.
-   [ ] Customer is directed to the customer portal.
-   [ ] Customer cannot access another user's records.

## Workflow B: Launch a new product and plan

-   [ ] Admin creates a product.
-   [ ] Admin enters product name, type, sales price, cost price, and
    notes.
-   [ ] Admin adds a variant with an additional price.
-   [ ] Admin creates a plan linked to the product.
-   [ ] Admin configures billing frequency and minimum quantity.
-   [ ] Admin configures plan availability and lifecycle permissions.
-   [ ] Product and plan are available according to their configuration.

## Workflow C: Create a quotation and subscription

-   [ ] Staff selects a customer.
-   [ ] Staff selects a quotation template.
-   [ ] Template product lines and plan are populated.
-   [ ] Quotation validity is calculated.
-   [ ] Staff reviews the quotation.
-   [ ] Quotation progresses through the agreed statuses.
-   [ ] Subscription is associated with the correct customer and plan.
-   [ ] Subscription product lines and totals are correct.
-   [ ] Subscription becomes Active after the required confirmation
    process.

## Workflow D: Automatic invoice generation

-   [ ] An active subscription reaches its billing date.
-   [ ] The scheduled billing process identifies it.
-   [ ] The system generates an invoice from the subscription.
-   [ ] Product lines, taxes, discounts, and totals are correct.
-   [ ] Invoice is linked to the subscription.
-   [ ] Re-running the billing process does not create a duplicate
    invoice.

## Workflow E: Discount application

-   [ ] Admin creates a discount rule.
-   [ ] A qualifying subscription meets the discount conditions.
-   [ ] The next eligible invoice includes the discount.
-   [ ] An ineligible subscription does not receive the discount.
-   [ ] An expired or exhausted discount is no longer applied.

## Workflow F: Payment recording

-   [ ] Customer's invoice is available to the authorized team.
-   [ ] Payment is received through a supported method.
-   [ ] Staff records the payment against the correct invoice.
-   [ ] Payment amount and date are stored.
-   [ ] Invoice paid and outstanding amounts are recalculated.
-   [ ] Invoice becomes Paid when fully settled.
-   [ ] The payment appears in payment history.

## Workflow G: Month-end finance review

-   [ ] Finance team can view active subscriptions.
-   [ ] Finance team can view revenue received.
-   [ ] Finance team can view outstanding amounts.
-   [ ] Finance team can identify overdue invoices.
-   [ ] Filters produce accurate results.
-   [ ] Dashboard summaries reconcile with the underlying records.

------------------------------------------------------------------------

# 16. Open Questions to Resolve Before Final Acceptance

The supplied brief does not fully specify the following items.
Product-owner decisions are required before they can be treated as fixed
acceptance criteria.

-   [ ] Exact permissions for each Internal Staff capability.
-   [ ] Whether customers can purchase plans and accept quotations
    directly.
-   [ ] Whether customers can pay online or payments are recorded
    internally.
-   [ ] Whether customers can pause, renew, or close subscriptions
    themselves.
-   [ ] Whether customer profile editing is included.
-   [ ] Exact tax types, tax inclusivity, jurisdiction, and rounding
    rules.
-   [ ] Whether invoices can be partially paid and how partial payment
    affects invoice status.
-   [ ] Whether refunds, payment reversals, and overpayments are in
    scope.
-   [ ] Exact quotation acceptance and expiry behavior.
-   [ ] Exact renewal behavior and whether renewal creates a new
    subscription or extends the existing one.
-   [ ] Exact behavior when a subscription is paused: whether billing
    dates move, billing stops, or another rule applies.
-   [ ] Exact invoice due-date and overdue calculation rules.
-   [ ] Whether invoice email delivery, PDF download, and customer-side
    printing are required.
-   [ ] Exact revenue definition for dashboard reporting: cash
    collected, invoices issued, or accounting revenue.
-   [ ] Exact performance test environment and dataset size.

------------------------------------------------------------------------

# 17. Test Execution Summary

Use this section to track overall testing progress.

  Area                             Total checks   Passed   Failed   Blocked
  ------------------------------ -------------- -------- -------- ---------
  Admin                                     ---      ---      ---       ---
  Internal Staff                            ---      ---      ---       ---
  Customer                                  ---      ---      ---       ---
  Authentication                            ---      ---      ---       ---
  Products and Variants                     ---      ---      ---       ---
  Subscription Plans                        ---      ---      ---       ---
  Quotations and Subscriptions              ---      ---      ---       ---
  Taxes and Discounts                       ---      ---      ---       ---
  Invoices and Billing                      ---      ---      ---       ---
  Payments                                  ---      ---      ---       ---
  Dashboard and Reports                     ---      ---      ---       ---
  Performance and Reliability               ---      ---      ---       ---
  End-to-End Workflows                      ---      ---      ---       ---

## Acceptance principle

The application should not be considered complete merely because pages
and buttons exist. Each applicable checklist item must be verified
against the actual business behavior, role permissions, stored data, and
end-to-end workflow. Requirements marked **Confirm with product owner**
must be decided before final acceptance.
