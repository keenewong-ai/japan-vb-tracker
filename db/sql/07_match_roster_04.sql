INSERT INTO match_roster (match_id,player_id) VALUES
($s$sv-men-osaka-b-wd-g2-2026-11-01$s$,$s$yamauchi-akihiro$s$),
($s$sv-men-osaka-b-wd-g2-2026-11-01$s$,$s$tomita-shoma$s$),
($s$sv-men-osaka-b-wd-g2-2026-11-01$s$,$s$kai-masato$s$),
($s$sv-men-osaka-b-wd-g2-2026-11-01$s$,$s$nishiyama-hiroto$s$),
($s$sv-men-osaka-b-wd-g2-2026-11-01$s$,$s$yamamoto-tomohiro$s$),
($s$sv-men-osaka-b-wd-g2-2026-11-01$s$,$s$evbade-dan-larry$s$),
($s$sv-men-osaka-b-wd-g2-2026-11-01$s$,$s$nishikawa-keitaro$s$),
($s$sv-men-osaka-b-wd-g2-2026-11-01$s$,$s$fukatsu-hideomi$s$),
($s$sv-men-osaka-b-wd-g2-2026-11-01$s$,$s$miyaura-kento$s$),
($s$sv-men-osaka-b-wd-g2-2026-11-01$s$,$s$sato-shunichiro$s$)
ON CONFLICT (match_id, player_id) DO NOTHING;