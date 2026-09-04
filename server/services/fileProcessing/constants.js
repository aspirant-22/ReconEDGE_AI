// Canonical (internal) field schemas, required fields and header synonyms
// used by the file-processing and column-mapping layer.
//
// The user's uploaded columns are NEVER assumed to match these names directly;
// they are mapped through columnMapper using these synonym tables.

const CANONICAL_SCHEMAS = {
  PAYMENTS: {
    fields: ['paymentId', 'customerId', 'amount', 'currency', 'paymentDate', 'reference'],
    required: ['paymentId', 'amount', 'paymentDate'],
  },
  BANK_TRANSACTIONS: {
    fields: ['transactionId', 'amount', 'currency', 'transactionDate', 'reference', 'description'],
    required: ['transactionId', 'amount', 'transactionDate'],
  },
  INVOICES: {
    fields: ['invoiceId', 'customerId', 'amount', 'currency', 'invoiceDate', 'reference'],
    required: ['invoiceId', 'amount', 'invoiceDate'],
  },
};

// Header synonyms (normalized: trimmed, lowercased, non-alphanumerics removed).
const HEADER_SYNONYMS = {
  paymentId: ['paymentid', 'paymentkey', 'paymentno', 'paymentnumber', 'paymentref', 'paymentreference', 'payment', 'id', 'reference'],
  customerId: ['customerid', 'customerno', 'customernumber', 'customer', 'clientid', 'clientno', 'accountid', 'customerref'],
  amount: ['amount', 'amountinr', 'paymentamount', 'transactionamount', 'txnamount', 'invoiceamount', 'value', 'grossamount', 'netamount', 'amt', 'total', 'dueamount'],
  currency: ['currency', 'ccy', 'currencycode', 'currencysymbol'],
  paymentDate: ['paymentdate', 'paymentdt', 'date', 'paymentdatedt', 'posteddate', 'transactiondate'],
  reference: ['reference', 'ref', 'referencenumber', 'referenceno', 'paymentreference', 'paymentref', 'txnref', 'txnreference', 'bankref', 'bankreference', 'utilityref', 'settlementref', 'narrationref'],
  transactionId: ['transactionid', 'txnid', 'txn', 'transactionno', 'transactionnumber', 'banktransactionid', 'settlementid', 'bankrefid', 'id'],
  transactionDate: ['transactiondate', 'txndate', 'datedt', 'date', 'valuedate', 'bankdate', 'postdate', 'posteddate'],
  invoiceId: ['invoiceid', 'invoiceno', 'invoicenumber', 'invoice', 'billno', 'billnumber', 'id', 'reference'],
  invoiceDate: ['invoicedate', 'invoicedt', 'date', 'billdate', 'duedate', 'invoicepostdate'],
  description: ['description', 'narration', 'details', 'remark', 'remarks', 'notes', 'paymentdetails', 'transactiondetails', 'banknarration', 'purpose'],
};

// Fields that are date-typed.
const DATE_FIELDS = ['paymentDate', 'transactionDate', 'invoiceDate'];

// Fields that are amount/number-typed.
const AMOUNT_FIELDS = ['amount'];

// Fields that are identifier-strings.
const ID_FIELDS = ['paymentId', 'transactionId', 'invoiceId'];

module.exports = {
  CANONICAL_SCHEMAS,
  HEADER_SYNONYMS,
  DATE_FIELDS,
  AMOUNT_FIELDS,
  ID_FIELDS,
};
