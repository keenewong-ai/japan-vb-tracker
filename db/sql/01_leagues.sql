INSERT INTO leagues (id,name,country,country_code,flag_path,gender) VALUES
($s$sv-league-women$s$,$s$SV.LEAGUE WOMEN$s$,$s$日本$s$,$s$jp$s$,$s$assets/flags/jp.svg$s$,$s$women$s$),
($s$sv-league-men$s$,$s$SV.LEAGUE MEN$s$,$s$日本$s$,$s$jp$s$,$s$assets/flags/jp.svg$s$,$s$men$s$),
($s$plusliga$s$,$s$PlusLiga$s$,$s$波蘭$s$,$s$pl$s$,$s$assets/flags/pl.svg$s$,NULL),
($s$bogdanka-cup$s$,$s$Bogdanka Cup$s$,$s$波蘭$s$,$s$pl$s$,$s$assets/flags/pl.svg$s$,NULL),
($s$sultanlar-ligi-women$s$,$s$Sultanlar Ligi (Women)$s$,$s$土耳其$s$,$s$tr$s$,$s$assets/flags/tr.svg$s$,$s$women$s$),
($s$efeler-ligi-men$s$,$s$Efeler Ligi (Men)$s$,$s$土耳其$s$,$s$tr$s$,$s$assets/flags/tr.svg$s$,$s$men$s$),
($s$serie-a1$s$,$s$Serie A1$s$,$s$意大利$s$,$s$it$s$,$s$assets/flags/it.svg$s$,NULL),
($s$superlega$s$,$s$SuperLega$s$,$s$意大利$s$,$s$it$s$,$s$assets/flags/it.svg$s$,NULL),
($s$asian-games$s$,$s$Asian Games$s$,$s$亞洲$s$,$s$asia$s$,$s$assets/flags/asia.svg$s$,NULL),
($s$sultanlar-ligi-men$s$,$s$Sultanlar Ligi (Men)$s$,NULL,NULL,NULL,$s$men$s$),
($s$lovb$s$,$s$LOVB$s$,NULL,NULL,NULL,NULL),
($s$usa-league$s$,$s$USA League$s$,NULL,NULL,NULL,NULL),
($s$ligue-a$s$,$s$Ligue A$s$,NULL,NULL,NULL,NULL)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, country=EXCLUDED.country, country_code=EXCLUDED.country_code, flag_path=EXCLUDED.flag_path, gender=EXCLUDED.gender;