-- P0 payment configuration hardening.
-- paymentMethods.config and merchant financial account config must contain only
-- customer-facing instructions. Gateway endpoints, API keys, tokens and custom
-- headers are server-only environment configuration and are discarded here.

UPDATE "payment_methods"
SET "config" = jsonb_strip_nulls(
  jsonb_build_object(
    'accountName', "config"->'accountName',
    'bankName', "config"->'bankName',
    'accountNumber', "config"->'accountNumber',
    'iban', "config"->'iban',
    'walletName', "config"->'walletName',
    'walletNumber', "config"->'walletNumber',
    'exchangeCompany', "config"->'exchangeCompany',
    'recipientName', "config"->'recipientName',
    'recipientPhone', "config"->'recipientPhone',
    'instructions', "config"->'instructions',
    'requiresProof', "config"->'requiresProof'
  )
);

UPDATE "merchant_financial_provider_accounts"
SET "config" = jsonb_strip_nulls(
  jsonb_build_object(
    'accountName', "config"->'accountName',
    'bankName', "config"->'bankName',
    'accountNumber', "config"->'accountNumber',
    'iban', "config"->'iban',
    'walletName', "config"->'walletName',
    'walletNumber', "config"->'walletNumber',
    'exchangeCompany', "config"->'exchangeCompany',
    'recipientName', "config"->'recipientName',
    'recipientPhone', "config"->'recipientPhone',
    'instructions', "config"->'instructions',
    'requiresProof', "config"->'requiresProof'
  )
);
