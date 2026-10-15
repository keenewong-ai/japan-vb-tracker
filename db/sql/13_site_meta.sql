INSERT INTO site_meta (key,value) VALUES
($s$lastUpdated$s$,$s$2026-10-15T14:46:31+08:00$s$),
($s$timezone$s$,$s$Asia/Taipei$s$),
($s$sourcesNote$s$,$s$2026-10-15 PM: player bio table (JVA/SVL/club/Wikipedia); modal scrollbar thin/dark; multi-season stats.$s$),
($s$version$s$,11)
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;