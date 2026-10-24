-- GLAMS BY LEE — 0004 safe seed data. No fake products, prices, reviews or contact details.

insert into categories (name, slug, sort_order) values
 ('Wigs','wigs',1),('Hair Bundles','hair-bundles',2),('Closures & Frontals','closures-frontals',3),
 ('Lace Front Wigs','lace-front-wigs',4),('Glueless Wigs','glueless-wigs',5),('Curly & Wavy Hair','curly-wavy-hair',6),
 ('Straight Hair','straight-hair',7),('Bob Wigs','bob-wigs',8),('Coloured Wigs','coloured-wigs',9),
 ('Hair Care','hair-care',10),('Accessories','accessories',11),('Wig Caps','wig-caps',12)
on conflict (slug) do nothing;

insert into site_content (key, value) values
 ('announcement_bar', '{"enabled": true, "text": "Premium styles for your next look"}'),
 ('hero', '{"headline":"Your Glam. Your Style. Your Confidence.","subtext":"Discover wigs, bundles and hair essentials curated to help you express your signature look.","primary_cta":{"label":"Shop Wigs","href":"/shop"},"secondary_cta":{"label":"Find Your Style","href":"/find-your-wig"},"image_url":null}')
on conflict (key) do nothing;

-- Public settings the owner must fill in. null = not configured, UI must hide the feature.
insert into admin_settings (key, value, is_public) values
 ('whatsapp_number', 'null', true),
 ('support_hours', 'null', true),
 ('contact_email', 'null', true),
 ('social_links', '{}', true),
 ('supported_currencies', '["GHS"]', true),
 ('default_currency', '"GHS"', true),
 ('low_stock_alert_enabled', 'true', false)
on conflict (key) do nothing;
