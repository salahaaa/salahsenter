-- Benchmark seed: inserts realistic data with base64 images to measure payload bloat.
-- Run: psql -U postgres -h /tmp -d marketplace -f scripts/benchmark-seed.sql
\set STOREID '5e95735b-5c71-4c37-8e74-893b44c98acb'
\set MERCHID 'ebcb558b-286e-416a-a971-51f8dbf91aad'
\set CUSTID '661edcff-3151-4697-8222-fc8ff2d4961b'
\set CATID '60d9580d-14b3-4014-a024-e53042998045'

-- A ~60KB base64 JPEG stub
\set BIGIMG '''data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc7PTXD'' || repeat(''A'', 60000)'

-- ============ WINGS (3, with 4 base64 fields each) ============
INSERT INTO wings (name, slug, icon_url, hero_image_url, mobile_image_url, desktop_image_url, description, is_active, sort_order)
VALUES ('جناح إلكترونيات', 'wing-elec', :BIGIMG, :BIGIMG, :BIGIMG, :BIGIMG, repeat('وصف الجناح ', 50), true, 1)
ON CONFLICT (slug) DO UPDATE SET icon_url=EXCLUDED.icon_url, hero_image_url=EXCLUDED.hero_image_url, mobile_image_url=EXCLUDED.mobile_image_url, desktop_image_url=EXCLUDED.desktop_image_url;
INSERT INTO wings (name, slug, icon_url, hero_image_url, mobile_image_url, desktop_image_url, description, is_active, sort_order)
VALUES ('جناح أزياء', 'wing-fashion', :BIGIMG, :BIGIMG, :BIGIMG, :BIGIMG, repeat('وصف الجناح ', 50), true, 2)
ON CONFLICT (slug) DO UPDATE SET icon_url=EXCLUDED.icon_url, hero_image_url=EXCLUDED.hero_image_url;
INSERT INTO wings (name, slug, icon_url, hero_image_url, mobile_image_url, desktop_image_url, description, is_active, sort_order)
VALUES ('جناح مطاعم', 'wing-food', :BIGIMG, :BIGIMG, :BIGIMG, :BIGIMG, repeat('وصف الجناح ', 50), true, 3)
ON CONFLICT (slug) DO UPDATE SET icon_url=EXCLUDED.icon_url, hero_image_url=EXCLUDED.hero_image_url;

-- ============ PRODUCTS (12, each with main image + 3 gallery base64 + big desc/specs) ============
INSERT INTO products (store_id, category_id, name, slug, product_code, short_description, description, main_image_url, images, specifications, brand, type, status, base_price, pricing_mode, inventory_mode, discount_percent)
SELECT :STOREID, :CATID, 'منتج اختبار ' || g, 'prod-bench-' || g, 'PCODE-' || g, repeat('وصف مختصر ', 10), repeat('وصف تفصيلي طويل جداً للمنتج ', 40), :BIGIMG, jsonb_build_array(:BIGIMG, :BIGIMG, :BIGIMG), jsonb_build_object('الماركة','تست','اللون','أزرق','الوزن','1kg'), 'تست براند', 'simple', 'active', '99.50', 'variant', 'variant', '0'
FROM generate_series(1, 12) AS g;

-- ============ STORE images (base64) ============
UPDATE stores SET cover_image_url = :BIGIMG, logo_url = :BIGIMG, intro_image_url = :BIGIMG WHERE id = :STOREID;

-- ============ ORDERS (5) ============
INSERT INTO orders (order_number, customer_id, store_id, status_code, payment_status, currency, subtotal, shipping_fee, discount_total, grand_total, delivery_address, customer_note)
SELECT 'ORD-BENCH-' || g, :CUSTID, :STOREID, 'new', 'pending', 'YER', '199.00', '15.00', '0', '214.00', jsonb_build_object('city','صنعاء','street','شارع '||g,'phone','0501234567'), repeat('ملاحظة عميل تجريبية ', 5)
FROM generate_series(1, 5) AS g;

-- ============ MERCHANT APPLICATIONS (3, with contract body + signature base64) ============
\set SIGIMG '''data:image/png;base64,iVBORw0KGgo='' || repeat('B'', ''B'', ''B'', repeat(''B'', 7000))'
INSERT INTO merchant_applications (applicant_user_id, applicant_name, applicant_email, applicant_phone, store_name, business_activity, status, social_links, description, contract_body, contract_signature_data_url, signed_contract_snapshot, contract_title, contract_version, contract_duration_days, commission_rate, subscription_fee)
SELECT :MERCHID, 'متجر بضاعة ' || g, 'bench'||g||'@example.com', '0509999999', 'متجر بضاعة ' || g, 'تجزئة', 'contract_signed', jsonb_build_object('instagram','@x'), repeat('وصف نشاط المتجر ', 20), repeat('بند العقد التعاقدي: ', 200), ('data:image/png;base64,iVBORw0KGgo' || repeat('B', 8000)), jsonb_build_object('storeName',('متجر '||g),'contractBody',repeat('بند',300)), 'عقد فتح متجر', '1.0', 365, '5.000', '0'
FROM generate_series(1, 3) AS g;

\echo 'Benchmark seed complete.'
SELECT 'wings' AS t, count(*) FROM wings
UNION ALL SELECT 'products_bench', count(*) FROM products WHERE slug LIKE 'prod-bench-%'
UNION ALL SELECT 'orders_bench', count(*) FROM orders WHERE order_number LIKE 'ORD-BENCH-%'
UNION ALL SELECT 'apps_bench', count(*) FROM merchant_applications WHERE applicant_email LIKE 'bench%@%';
