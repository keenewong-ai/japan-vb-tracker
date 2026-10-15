INSERT INTO gossip_players (gossip_id,player_id) VALUES
($s$mayu-turkish-pr-video-2026-10-14$s$,$s$ishikawa-mayu$s$),
($s$mayu-ecz-first-point-2026-10-11$s$,$s$ishikawa-mayu$s$),
($s$otsuka-milan-depart-2026-10-04$s$,$s$otsuka-tatsunori$s$),
($s$uyba-japan-trio-present-2026-10-01$s$,$s$seki-nanami$s$),
($s$uyba-japan-trio-present-2026-10-01$s$,$s$wada-yukiko$s$),
($s$sato-yoshino-milan-arrive-2026-09-29$s$,$s$sato-yoshino$s$),
($s$ran-seiro-poland-2026-09-23$s$,$s$takahashi-ran$s$),
($s$yuki-turkey-depart-ig-2026-09-21$s$,$s$ishikawa-yuki$s$),
($s$ogawa-haircut-lublin-2026-09-21$s$,$s$ogawa-tomohiro$s$),
($s$mayu-photobook-turkey-2026-07-30$s$,$s$ishikawa-mayu$s$),
($s$yuki-ziraat-transfer-2026-06-05$s$,$s$ishikawa-yuki$s$),
($s$yuki-ziraat-transfer-2026-06-05$s$,$s$ishikawa-mayu$s$),
($s$ran-lublin-transfer-2026-05-29$s$,$s$takahashi-ran$s$),
($s$otsuka-milan-renew-2026-05-29$s$,$s$otsuka-tatsunori$s$),
($s$ogawa-lublin-transfer-2026-06-01$s$,$s$ogawa-tomohiro$s$),
($s$ogawa-lublin-transfer-2026-06-01$s$,$s$takahashi-ran$s$)
ON CONFLICT (gossip_id, player_id) DO NOTHING;