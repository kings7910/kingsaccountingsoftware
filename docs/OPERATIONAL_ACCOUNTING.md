# Posting operational records

Open **Accounting → Operational posting** as an owner, administrator, or accountant. Auditors can read the queue.

- **Fuel:** approve the fuel entry first. Choose **Post cost**, then **Paid expense** and the cash/bank account, or **Unpaid vendor bill** and its due date.
- **Maintenance:** complete the work order and enter its actual cost. An unpaid bill also requires an assigned vendor. Post the actual cost using the same choices.
- **Loads:** mark the load delivered and assign its customer. Choose **Issue invoice** and the issue/due dates. The invoice includes the freight rate plus fuel surcharge and posts to receivables. This action does not send an email.

Review the posting date before confirming. Closed accounting periods reject posting. Paid expenses debit fuel/maintenance expense and credit the selected cash account. Unpaid bills credit accounts payable. Issued load invoices debit accounts receivable and credit freight revenue.

Posted costs remain linked to their original records. Repeating the same request returns the same accounting record; changing the posting choices after success is rejected. Fuel and maintenance records cannot be edited or deleted after posting. Load customer, charges and billing details remain locked once an invoice is linked. The source modules show their accounting linkage and hide edit/delete controls.

Use Transactions, Bills & payables, or Invoices to view the resulting records and their existing correction workflows. Reversing an accounting entry does not remove its source link or enable another automatic posting. Corrected replacement entries must be handled explicitly in accounting.

The queue does not match historical manually entered expenses or bills to operational records. Review existing accounting before posting an older source. It also does not upload proof of delivery, generate invoice PDFs, email customers, or execute payments.
