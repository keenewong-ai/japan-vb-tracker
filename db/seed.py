#!/usr/bin/env python3
"""Seed japan-vb-tracker JSON data into Supabase Postgres via generated SQL.

Usage:
  python3 db/seed.py                 # write SQL batches under db/sql/
  python3 db/seed.py --print-meta    # print batch file list + expected counts

Does NOT call Supabase itself — executor runs batches with execute_sql.
Safe to re-run: all inserts use ON CONFLICT DO UPDATE / DO NOTHING.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = Path(__file__).resolve().parent / "sql"

# Fullwidth Latin -> ASCII (teams.json uses ＫＵＲＯＢＥ…)
_FW = str.maketrans({chr(0xFF01 + i): chr(0x21 + i) for i in range(94)})


def norm_name(s: str) -> str:
    return (s or "").translate(_FW).strip()


def slugify(name: str) -> str:
    s = norm_name(name).lower()
    s = s.replace("&", " and ")
    s = re.sub(r"[（(].*?[）)]", "", s)  # drop parenthetical
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "-", s.strip())
    s = re.sub(r"-+", "-", s).strip("-")
    if not s:
        # fallback for CJK-only: keep unicode letters via NFKC-ish id
        s = re.sub(r"\s+", "-", norm_name(name).lower())
        s = re.sub(r"[^\w-]", "", s, flags=re.UNICODE) or "team"
    return s[:80]


def league_id_from_name(name: str) -> str:
    mapping = {
        "SV.LEAGUE WOMEN": "sv-league-women",
        "SV.LEAGUE MEN": "sv-league-men",
        "PlusLiga": "plusliga",
        "Bogdanka Cup": "bogdanka-cup",
        "Sultanlar Ligi (Women)": "sultanlar-ligi-women",
        "Sultanlar Ligi (Men)": "sultanlar-ligi-men",
        "Efeler Ligi (Men)": "efeler-ligi-men",
        "Serie A1": "serie-a1",
        "SuperLega": "superlega",
        "Asian Games": "asian-games",
        "LOVB": "lovb",
        "Ligue A": "ligue-a",
        "USA League": "usa-league",
    }
    return mapping.get(name, slugify(name))


def league_gender(name: str) -> str | None:
    n = name.lower()
    if "women" in n or "woman" in n:
        return "women"
    if "men" in n and "women" not in n:
        return "men"
    return None


def team_id_from_entry(name: str, meta: dict) -> str:
    logo = (meta or {}).get("logo") or ""
    m = re.search(r"/([^/]+)\.(png|jpg|jpeg|svg|webp)$", logo, re.I)
    if m:
        return m.group(1).lower()
    return "team-" + slugify(name)


def sql_str(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return str(v)
    # dollar-quote
    s = str(v)
    tag = "s"
    while f"${tag}$" in s:
        tag += "x"
    return f"${tag}${s}${tag}$"


def sql_num(v):
    if v is None or v == "":
        return "NULL"
    return str(v)


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i : i + n]


def load():
    return {
        "leagues": json.loads((DATA / "leagues.json").read_text(encoding="utf-8")),
        "teams": json.loads((DATA / "teams.json").read_text(encoding="utf-8")),
        "players": json.loads((DATA / "players.json").read_text(encoding="utf-8")),
        "player_stats": json.loads((DATA / "player-stats.json").read_text(encoding="utf-8")),
        "matches": json.loads((DATA / "matches.json").read_text(encoding="utf-8")),
        "gossip": json.loads((DATA / "gossip.json").read_text(encoding="utf-8")),
        "social": json.loads((DATA / "social.json").read_text(encoding="utf-8")),
        "meta": json.loads((DATA / "meta.json").read_text(encoding="utf-8")),
    }


def build(data):
    skipped = []
    batches = []  # list of (name, sql)

    # --- leagues ---
    league_rows = {}
    for name, meta in data["leagues"].items():
        lid = league_id_from_name(name)
        league_rows[lid] = {
            "id": lid,
            "name": name,
            "country": meta.get("country"),
            "country_code": meta.get("countryCode"),
            "flag_path": meta.get("flag"),
            "gender": league_gender(name),
        }
    # extra leagues referenced by players
    for p in data["players"]:
        ln = p.get("league")
        if not ln:
            continue
        lid = league_id_from_name(ln)
        if lid not in league_rows:
            league_rows[lid] = {
                "id": lid,
                "name": ln,
                "country": None,
                "country_code": None,
                "flag_path": None,
                "gender": league_gender(ln),
            }
            skipped.append(f"added_missing_league:{ln}")

    name_to_league_id = {r["name"]: r["id"] for r in league_rows.values()}
    # also map by id keys for safety
    for r in league_rows.values():
        name_to_league_id[r["id"]] = r["id"]

    vals = []
    for r in league_rows.values():
        vals.append(
            f"({sql_str(r['id'])},{sql_str(r['name'])},{sql_str(r['country'])},"
            f"{sql_str(r['country_code'])},{sql_str(r['flag_path'])},{sql_str(r['gender'])})"
        )
    sql = (
        "INSERT INTO leagues (id,name,country,country_code,flag_path,gender) VALUES\n"
        + ",\n".join(vals)
        + "\nON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, country=EXCLUDED.country, "
        "country_code=EXCLUDED.country_code, flag_path=EXCLUDED.flag_path, gender=EXCLUDED.gender;"
    )
    batches.append(("01_leagues", sql))

    # --- teams ---
    # Normalize map: norm_name -> original key in teams.json
    teams_by_norm = {norm_name(k): k for k in data["teams"]}
    team_rows = {}  # id -> row
    name_to_team_id = {}  # display name variants -> id

    # Infer league from player clubs
    club_league = {}
    for p in data["players"]:
        if p.get("club") and p.get("league"):
            club_league[norm_name(p["club"])] = p["league"]

    for raw_name, meta in data["teams"].items():
        tid = team_id_from_entry(raw_name, meta)
        # avoid collision
        base_tid = tid
        i = 2
        while tid in team_rows and team_rows[tid]["name"] != raw_name:
            tid = f"{base_tid}-{i}"
            i += 1
        ln = club_league.get(norm_name(raw_name))
        # heuristic from logo/source
        if not ln:
            src = (meta or {}).get("source") or ""
            logo = (meta or {}).get("logo") or ""
            if "svleague" in src or "/sv-" in logo or logo.startswith("assets/teams/sv-"):
                # gender unknown — leave null unless name hints
                pass
            lid = None
        else:
            lid = name_to_league_id.get(ln)
        if not ln:
            lid = None
        else:
            lid = name_to_league_id.get(ln)
        team_rows[tid] = {
            "id": tid,
            "name": raw_name,
            "name_en": None,
            "league_id": lid,
            "logo_path": (meta or {}).get("logo"),
        }
        name_to_team_id[raw_name] = tid
        name_to_team_id[norm_name(raw_name)] = tid

    # stub teams for player clubs / match names missing from teams.json
    extra_names = set()
    for p in data["players"]:
        if p.get("club"):
            extra_names.add(p["club"])
    for m in data["matches"]:
        extra_names.add(m["home"])
        extra_names.add(m["away"])

    for nm in sorted(extra_names):
        if nm in name_to_team_id or norm_name(nm) in name_to_team_id:
            # link alias
            if nm not in name_to_team_id:
                name_to_team_id[nm] = name_to_team_id[norm_name(nm)]
            continue
        # maybe fullwidth variant in teams
        nrm = norm_name(nm)
        if nrm in teams_by_norm:
            orig = teams_by_norm[nrm]
            name_to_team_id[nm] = name_to_team_id[orig]
            continue
        tid = "team-" + slugify(nm)
        base_tid = tid
        i = 2
        while tid in team_rows:
            tid = f"{base_tid}-{i}"
            i += 1
        ln = club_league.get(nrm)
        lid = name_to_league_id.get(ln) if ln else None
        team_rows[tid] = {
            "id": tid,
            "name": nm,
            "name_en": None,
            "league_id": lid,
            "logo_path": None,
        }
        name_to_team_id[nm] = tid
        name_to_team_id[nrm] = tid
        skipped.append(f"added_stub_team:{nm}")

    for batch_i, part in enumerate(chunks(list(team_rows.values()), 40)):
        vals = []
        for r in part:
            vals.append(
                f"({sql_str(r['id'])},{sql_str(r['name'])},{sql_str(r['name_en'])},"
                f"{sql_str(r['league_id'])},{sql_str(r['logo_path'])})"
            )
        sql = (
            "INSERT INTO teams (id,name,name_en,league_id,logo_path) VALUES\n"
            + ",\n".join(vals)
            + "\nON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, name_en=EXCLUDED.name_en, "
            "league_id=EXCLUDED.league_id, logo_path=EXCLUDED.logo_path;"
        )
        batches.append((f"02_teams_{batch_i:02d}", sql))

    # --- players ---
    player_ids = set()
    name_to_player_id = {}
    for batch_i, part in enumerate(chunks(data["players"], 20)):
        vals = []
        for p in part:
            pid = p["id"]
            player_ids.add(pid)
            name_to_player_id[p["name"]] = pid
            if p.get("nameEn"):
                name_to_player_id[p["nameEn"]] = pid
            club = p.get("club")
            tid = None
            if club:
                tid = name_to_team_id.get(club) or name_to_team_id.get(norm_name(club))
            lid = name_to_league_id.get(p.get("league")) if p.get("league") else None
            photo = p.get("photo")
            # store path as in JSON
            vals.append(
                "("
                + ",".join(
                    [
                        sql_str(pid),
                        sql_str(p.get("name")),
                        sql_str(p.get("nameEn")),
                        sql_str(p.get("gender")),
                        sql_str(p.get("position")),
                        sql_str(tid),
                        sql_str(lid),
                        sql_str(p.get("nationality")),
                        sql_str(p.get("hometown")),
                        sql_str(p.get("birthDate")),
                        sql_num(p.get("heightCm")),
                        sql_num(p.get("weightKg")),
                        sql_num(p.get("spikeCm")),
                        sql_num(p.get("blockCm")),
                        sql_str(p.get("hand")),
                        sql_str(photo),
                        sql_str(p.get("note")),
                        sql_str(bool(p.get("vnl2026"))),
                    ]
                )
                + ")"
            )
        sql = (
            "INSERT INTO players (id,name,name_en,gender,position,team_id,league_id,"
            "nationality,hometown,birth_date,height_cm,weight_kg,spike_cm,block_cm,"
            "hand,photo_path,note,vnl_2026) VALUES\n"
            + ",\n".join(vals)
            + "\nON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, name_en=EXCLUDED.name_en, "
            "gender=EXCLUDED.gender, position=EXCLUDED.position, team_id=EXCLUDED.team_id, "
            "league_id=EXCLUDED.league_id, nationality=EXCLUDED.nationality, "
            "hometown=EXCLUDED.hometown, birth_date=EXCLUDED.birth_date, "
            "height_cm=EXCLUDED.height_cm, weight_kg=EXCLUDED.weight_kg, "
            "spike_cm=EXCLUDED.spike_cm, block_cm=EXCLUDED.block_cm, hand=EXCLUDED.hand, "
            "photo_path=EXCLUDED.photo_path, note=EXCLUDED.note, vnl_2026=EXCLUDED.vnl_2026;"
        )
        batches.append((f"03_players_{batch_i:02d}", sql))

    # --- player_season_stats ---
    stat_rows = []
    ps_players = data["player_stats"].get("players") or {}
    for pid, pdata in ps_players.items():
        if pid not in player_ids:
            skipped.append(f"stats_skip_unknown_player:{pid}")
            continue
        seasons = pdata.get("seasons")
        if not seasons and "points" in pdata:
            seasons = [pdata]
        for s in seasons or []:
            stat_rows.append(
                {
                    "player_id": pid,
                    "season": s.get("season") or "unknown",
                    "source": s.get("source"),
                    "source_url": s.get("sourceUrl"),
                    "note": s.get("note"),
                    "matches": s.get("matches"),
                    "sets": s.get("sets"),
                    "points": s.get("points"),
                    "avg_points": s.get("avgPoints"),
                    "attack_points": s.get("attackPoints"),
                    "attack_attempts": s.get("attackAttempts"),
                    "attack_success_pct": s.get("attackSuccessPct"),
                    "block_points": s.get("blockPoints"),
                    "serve_points": s.get("servePoints"),
                    "digs": s.get("digs"),
                    "dig_success_pct": s.get("digSuccessPct"),
                    "receptions": s.get("receptions"),
                    "rec_positive_pct": s.get("recPositivePct"),
                    "avg_blocks": s.get("avgBlocks"),
                    "avg_aces": s.get("avgAces"),
                    "avg_attack_points": s.get("avgAttackPoints"),
                }
            )

    for batch_i, part in enumerate(chunks(stat_rows, 25)):
        vals = []
        for r in part:
            vals.append(
                "("
                + ",".join(
                    [
                        sql_str(r["player_id"]),
                        sql_str(r["season"]),
                        sql_str(r["source"]),
                        sql_str(r["source_url"]),
                        sql_str(r["note"]),
                        sql_num(r["matches"]),
                        sql_num(r["sets"]),
                        sql_num(r["points"]),
                        sql_num(r["avg_points"]),
                        sql_num(r["attack_points"]),
                        sql_num(r["attack_attempts"]),
                        sql_num(r["attack_success_pct"]),
                        sql_num(r["block_points"]),
                        sql_num(r["serve_points"]),
                        sql_num(r["digs"]),
                        sql_num(r["dig_success_pct"]),
                        sql_num(r["receptions"]),
                        sql_num(r["rec_positive_pct"]),
                        sql_num(r["avg_blocks"]),
                        sql_num(r["avg_aces"]),
                        sql_num(r["avg_attack_points"]),
                    ]
                )
                + ")"
            )
        sql = (
            "INSERT INTO player_season_stats (player_id,season,source,source_url,note,"
            "matches,sets,points,avg_points,attack_points,attack_attempts,attack_success_pct,"
            "block_points,serve_points,digs,dig_success_pct,receptions,rec_positive_pct,"
            "avg_blocks,avg_aces,avg_attack_points) VALUES\n"
            + ",\n".join(vals)
            + "\nON CONFLICT (player_id, season) DO UPDATE SET "
            "source=EXCLUDED.source, source_url=EXCLUDED.source_url, note=EXCLUDED.note, "
            "matches=EXCLUDED.matches, sets=EXCLUDED.sets, points=EXCLUDED.points, "
            "avg_points=EXCLUDED.avg_points, attack_points=EXCLUDED.attack_points, "
            "attack_attempts=EXCLUDED.attack_attempts, "
            "attack_success_pct=EXCLUDED.attack_success_pct, "
            "block_points=EXCLUDED.block_points, serve_points=EXCLUDED.serve_points, "
            "digs=EXCLUDED.digs, dig_success_pct=EXCLUDED.dig_success_pct, "
            "receptions=EXCLUDED.receptions, rec_positive_pct=EXCLUDED.rec_positive_pct, "
            "avg_blocks=EXCLUDED.avg_blocks, avg_aces=EXCLUDED.avg_aces, "
            "avg_attack_points=EXCLUDED.avg_attack_points;"
        )
        batches.append((f"04_player_stats_{batch_i:02d}", sql))

    # --- matches + children ---
    match_vals_batches = []
    set_rows = []
    roster_rows = []
    mp_stat_rows = []

    for m in data["matches"]:
        mid = m["id"]
        score = m.get("score") or ""
        home_sets = away_sets = None
        if re.match(r"^\d+-\d+$", score.strip()):
            a, b = score.strip().split("-")
            home_sets, away_sets = int(a), int(b)
        home = m["home"]
        away = m["away"]
        hid = name_to_team_id.get(home) or name_to_team_id.get(norm_name(home))
        aid = name_to_team_id.get(away) or name_to_team_id.get(norm_name(away))
        comp = m.get("competition")
        lid = name_to_league_id.get(comp) if comp else None
        # country code: allow asia etc (column widened to text)
        match_vals_batches.append(
            {
                "id": mid,
                "competition": comp,
                "league_id": lid,
                "league_country": m.get("leagueCountry"),
                "league_country_code": m.get("leagueCountryCode"),
                "gender": m.get("gender"),
                "datetime_utc": m.get("datetime"),
                "status": m.get("status"),
                "home_team_id": hid,
                "away_team_id": aid,
                "home_name": home,
                "away_name": away,
                "home_sets": home_sets,
                "away_sets": away_sets,
                "venue": m.get("venue"),
                "broadcast": m.get("broadcast"),
                "note": m.get("note"),
            }
        )
        for i, ss in enumerate(m.get("setScores") or [], start=1):
            if not re.match(r"^\d+-\d+$", str(ss).strip()):
                skipped.append(f"bad_set_score:{mid}:{ss}")
                continue
            hp, ap = str(ss).strip().split("-")
            set_rows.append((mid, i, int(hp), int(ap)))
        for jp in m.get("japanPlayers") or []:
            pid = name_to_player_id.get(jp) or (jp if jp in player_ids else None)
            if not pid:
                skipped.append(f"roster_unresolved:{mid}:{jp}")
                continue
            roster_rows.append((mid, pid))
        for key, st in (m.get("playerStats") or {}).items():
            pid = name_to_player_id.get(key) or (key if key in player_ids else None)
            if not pid:
                skipped.append(f"match_stats_unresolved:{mid}:{key}")
                continue
            mp_stat_rows.append(
                (
                    mid,
                    pid,
                    st.get("points") if isinstance(st, dict) else None,
                    st.get("attacks") if isinstance(st, dict) else None,
                    st.get("blocks") if isinstance(st, dict) else None,
                    st.get("serves") if isinstance(st, dict) else None,
                )
            )

    for batch_i, part in enumerate(chunks(match_vals_batches, 20)):
        vals = []
        for r in part:
            vals.append(
                "("
                + ",".join(
                    [
                        sql_str(r["id"]),
                        sql_str(r["competition"]),
                        sql_str(r["league_id"]),
                        sql_str(r["league_country"]),
                        sql_str(r["league_country_code"]),
                        sql_str(r["gender"]),
                        sql_str(r["datetime_utc"]),
                        sql_str(r["status"]),
                        sql_str(r["home_team_id"]),
                        sql_str(r["away_team_id"]),
                        sql_str(r["home_name"]),
                        sql_str(r["away_name"]),
                        sql_num(r["home_sets"]),
                        sql_num(r["away_sets"]),
                        sql_str(r["venue"]),
                        sql_str(r["broadcast"]),
                        sql_str(r["note"]),
                    ]
                )
                + ")"
            )
        sql = (
            "INSERT INTO matches (id,competition,league_id,league_country,league_country_code,"
            "gender,datetime_utc,status,home_team_id,away_team_id,home_name,away_name,"
            "home_sets,away_sets,venue,broadcast,note) VALUES\n"
            + ",\n".join(vals)
            + "\nON CONFLICT (id) DO UPDATE SET competition=EXCLUDED.competition, "
            "league_id=EXCLUDED.league_id, league_country=EXCLUDED.league_country, "
            "league_country_code=EXCLUDED.league_country_code, gender=EXCLUDED.gender, "
            "datetime_utc=EXCLUDED.datetime_utc, status=EXCLUDED.status, "
            "home_team_id=EXCLUDED.home_team_id, away_team_id=EXCLUDED.away_team_id, "
            "home_name=EXCLUDED.home_name, away_name=EXCLUDED.away_name, "
            "home_sets=EXCLUDED.home_sets, away_sets=EXCLUDED.away_sets, "
            "venue=EXCLUDED.venue, broadcast=EXCLUDED.broadcast, note=EXCLUDED.note;"
        )
        batches.append((f"05_matches_{batch_i:02d}", sql))

    for batch_i, part in enumerate(chunks(set_rows, 50)):
        vals = [f"({sql_str(a)},{b},{c},{d})" for a, b, c, d in part]
        sql = (
            "INSERT INTO match_sets (match_id,set_no,home_points,away_points) VALUES\n"
            + ",\n".join(vals)
            + "\nON CONFLICT (match_id, set_no) DO UPDATE SET "
            "home_points=EXCLUDED.home_points, away_points=EXCLUDED.away_points;"
        )
        batches.append((f"06_match_sets_{batch_i:02d}", sql))

    for batch_i, part in enumerate(chunks(roster_rows, 50)):
        vals = [f"({sql_str(a)},{sql_str(b)})" for a, b in part]
        sql = (
            "INSERT INTO match_roster (match_id,player_id) VALUES\n"
            + ",\n".join(vals)
            + "\nON CONFLICT (match_id, player_id) DO NOTHING;"
        )
        batches.append((f"07_match_roster_{batch_i:02d}", sql))

    if mp_stat_rows:
        for batch_i, part in enumerate(chunks(mp_stat_rows, 50)):
            vals = [
                f"({sql_str(a)},{sql_str(b)},{sql_num(c)},{sql_num(d)},{sql_num(e)},{sql_num(f)})"
                for a, b, c, d, e, f in part
            ]
            sql = (
                "INSERT INTO match_player_stats (match_id,player_id,points,attacks,blocks,serves) VALUES\n"
                + ",\n".join(vals)
                + "\nON CONFLICT (match_id, player_id) DO UPDATE SET "
                "points=EXCLUDED.points, attacks=EXCLUDED.attacks, "
                "blocks=EXCLUDED.blocks, serves=EXCLUDED.serves;"
            )
            batches.append((f"08_match_player_stats_{batch_i:02d}", sql))

    # --- gossip ---
    g_vals = []
    gp_rows = []
    gt_rows = []
    for g in data["gossip"]:
        gid = g["id"]
        g_vals.append(
            f"({sql_str(gid)},{sql_str(g.get('title'))},{sql_str(g.get('summary'))},"
            f"{sql_str(g.get('date'))},{sql_str(g.get('source'))},{sql_str(g.get('sourceUrl'))})"
        )
        for pid in g.get("playerIds") or []:
            if pid not in player_ids:
                skipped.append(f"gossip_player_skip:{gid}:{pid}")
                continue
            gp_rows.append((gid, pid))
        for tag in g.get("tags") or []:
            gt_rows.append((gid, tag))
    batches.append(
        (
            "09_gossip_posts",
            "INSERT INTO gossip_posts (id,title,summary,date,source,source_url) VALUES\n"
            + ",\n".join(g_vals)
            + "\nON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, "
            "date=EXCLUDED.date, source=EXCLUDED.source, source_url=EXCLUDED.source_url;",
        )
    )
    if gp_rows:
        vals = [f"({sql_str(a)},{sql_str(b)})" for a, b in gp_rows]
        batches.append(
            (
                "10_gossip_players",
                "INSERT INTO gossip_players (gossip_id,player_id) VALUES\n"
                + ",\n".join(vals)
                + "\nON CONFLICT (gossip_id, player_id) DO NOTHING;",
            )
        )
    if gt_rows:
        vals = [f"({sql_str(a)},{sql_str(b)})" for a, b in gt_rows]
        batches.append(
            (
                "11_gossip_tags",
                "INSERT INTO gossip_tags (gossip_id,tag) VALUES\n"
                + ",\n".join(vals)
                + "\nON CONFLICT (gossip_id, tag) DO NOTHING;",
            )
        )

    # --- social ---
    for batch_i, part in enumerate(chunks(data["social"], 20)):
        vals = []
        for s in part:
            pid = s.get("playerId")
            if pid and pid not in player_ids:
                skipped.append(f"social_player_nullify:{s.get('id')}:{pid}")
                pid = None
            vals.append(
                f"({sql_str(s.get('id'))},{sql_str(pid)},{sql_str(s.get('playerName'))},"
                f"{sql_str(s.get('platform'))},{sql_str(s.get('account'))},"
                f"{sql_str(s.get('caption'))},{sql_str(s.get('date'))},"
                f"{sql_str(s.get('image'))},{sql_str(s.get('postUrl'))})"
            )
        sql = (
            "INSERT INTO social_posts (id,player_id,player_name,platform,account,caption,"
            "posted_on,image_path,post_url) VALUES\n"
            + ",\n".join(vals)
            + "\nON CONFLICT (id) DO UPDATE SET player_id=EXCLUDED.player_id, "
            "player_name=EXCLUDED.player_name, platform=EXCLUDED.platform, "
            "account=EXCLUDED.account, caption=EXCLUDED.caption, "
            "posted_on=EXCLUDED.posted_on, image_path=EXCLUDED.image_path, "
            "post_url=EXCLUDED.post_url;"
        )
        batches.append((f"12_social_{batch_i:02d}", sql))

    # --- site_meta ---
    meta_vals = [f"({sql_str(k)},{sql_str(v if not isinstance(v, (dict,list)) else json.dumps(v, ensure_ascii=False))})" for k, v in data["meta"].items()]
    batches.append(
        (
            "13_site_meta",
            "INSERT INTO site_meta (key,value) VALUES\n"
            + ",\n".join(meta_vals)
            + "\nON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;",
        )
    )

    counts = {
        "leagues": len(league_rows),
        "teams": len(team_rows),
        "players": len(data["players"]),
        "player_season_stats": len(stat_rows),
        "matches": len(match_vals_batches),
        "match_sets": len(set_rows),
        "match_roster": len(roster_rows),
        "match_player_stats": len(mp_stat_rows),
        "gossip_posts": len(data["gossip"]),
        "gossip_players": len(gp_rows),
        "gossip_tags": len(gt_rows),
        "social_posts": len(data["social"]),
        "site_meta": len(data["meta"]),
    }
    return batches, counts, skipped


def main():
    data = load()
    batches, counts, skipped = build(data)
    OUT.mkdir(parents=True, exist_ok=True)
    # clear old
    for p in OUT.glob("*.sql"):
        p.unlink()
    manifest = []
    for name, sql in batches:
        path = OUT / f"{name}.sql"
        path.write_text(sql, encoding="utf-8")
        manifest.append({"name": name, "path": str(path), "bytes": len(sql.encode())})
    summary = {"expected_counts": counts, "batches": len(batches), "skipped_notes": skipped}
    (OUT / "manifest.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"batches": len(batches), "expected_counts": counts, "skipped": len(skipped)}, ensure_ascii=False, indent=2))
    for s in skipped:
        if not s.startswith("added_"):
            print("SKIP:", s)
    for s in skipped:
        if s.startswith("added_"):
            print("NOTE:", s)


if __name__ == "__main__":
    main()
