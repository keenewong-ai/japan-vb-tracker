INSERT INTO match_player_stats (match_id,player_id,points,attacks,blocks,serves) VALUES
($s$asian-games-men-sf-2026-10-02$s$,$s$nishiyama-hiroto$s$,28,NULL,NULL,NULL),
($s$asian-games-men-sf-2026-10-02$s$,$s$kai-masato$s$,18,NULL,NULL,NULL),
($s$asian-games-men-sf-2026-10-02$s$,$s$otsuka-tatsunori$s$,17,NULL,NULL,NULL),
($s$asian-games-men-final-2026-10-03$s$,$s$otsuka-tatsunori$s$,22,NULL,NULL,NULL),
($s$serie-a1-busto-novara-2026-10-05$s$,$s$wada-yukiko$s$,14,NULL,NULL,NULL),
($s$serie-a1-busto-novara-2026-10-05$s$,$s$seki-nanami$s$,3,NULL,NULL,NULL),
($s$serie-a1-conegliano-busto-2026-10-11$s$,$s$wada-yukiko$s$,12,NULL,NULL,NULL),
($s$serie-a1-macerata-milano-2026-10-11$s$,$s$sato-yoshino$s$,2,NULL,NULL,NULL)
ON CONFLICT (match_id, player_id) DO UPDATE SET points=EXCLUDED.points, attacks=EXCLUDED.attacks, blocks=EXCLUDED.blocks, serves=EXCLUDED.serves;